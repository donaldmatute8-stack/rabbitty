import Foundation
import UIKit
import AVFoundation
import Vision
import ImageIO
import Capacitor

/**
 * RabbittyScannerPlugin
 *
 * Cámara nativa (AVFoundation) insertada DETRÁS del WebView + Vision para leer
 * QR. Devuelve `rawValue` y `cornerPoints` ya convertidos a puntos de pantalla,
 * así el overlay del WebView los usa tal cual (mismo contrato que ML Kit).
 *
 * Sin CocoaPods: se distribuye como Swift Package local (SPM).
 */
@objc(RabbittyScannerPlugin)
public class RabbittyScannerPlugin: CAPPlugin, CAPBridgedPlugin, AVCaptureVideoDataOutputSampleBufferDelegate {

    public let identifier = "RabbittyScannerPlugin"
    public let jsName = "RabbittyScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enableTorch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disableTorch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isTorchAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setZoomRatio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getMaxZoomRatio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanImage", returnType: CAPPluginReturnPromise)
    ]

    private var session: AVCaptureSession?
    private let sessionQueue = DispatchQueue(label: "com.rabbitty.scanner.session")
    private let videoQueue = DispatchQueue(label: "com.rabbitty.scanner.video")
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var previewContainer: UIView?
    private var device: AVCaptureDevice?
    private var isScanning = false
    private var lastEmit = Date.distantPast

    // MARK: - Start / Stop

    @objc func start(_ call: CAPPluginCall) {
        guard !isScanning else {
            call.resolve()
            return
        }

        let status = AVCaptureDevice.authorizationStatus(for: .video)
        switch status {
        case .authorized:
            self.beginSession(call: call)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                guard granted else {
                    call.reject("Permiso de cámara denegado")
                    return
                }
                self?.beginSession(call: call)
            }
        default:
            call.reject("Permiso de cámara denegado")
        }
    }

    private func beginSession(call: CAPPluginCall) {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
                call.reject("No hay cámara trasera disponible")
                return
            }
            self.device = device

            let session = AVCaptureSession()
            session.sessionPreset = .high

            do {
                let input = try AVCaptureDeviceInput(device: device)
                if session.canAddInput(input) { session.addInput(input) }
            } catch {
                call.reject("No se pudo abrir la cámara: \(error.localizedDescription)")
                return
            }

            let output = AVCaptureVideoDataOutput()
            output.alwaysDiscardsLateVideoFrames = true
            output.setSampleBufferDelegate(self, queue: self.videoQueue)
            if session.canAddOutput(output) { session.addOutput(output) }

            session.startRunning()
            self.session = session
            self.isScanning = true

            DispatchQueue.main.async {
                self.attachPreview(session: session)
                call.resolve()
            }
        }
    }

    private func attachPreview(session: AVCaptureSession) {
        guard let webView = self.bridge?.webView else { return }

        // La cámara vive detrás del contenido web.
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear

        let container = UIView(frame: webView.bounds)
        container.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        container.isUserInteractionEnabled = false

        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = container.bounds
        container.layer.addSublayer(layer)

        if let superview = webView.superview {
            superview.insertSubview(container, belowSubview: webView)
        }

        self.previewContainer = container
        self.previewLayer = layer
    }

    @objc func stop(_ call: CAPPluginCall) {
        isScanning = false
        let sessionToStop = session
        session = nil
        sessionQueue.async {
            sessionToStop?.stopRunning()
        }
        DispatchQueue.main.async {
            self.previewLayer?.removeFromSuperlayer()
            self.previewLayer = nil
            self.previewContainer?.removeFromSuperview()
            self.previewContainer = nil
            call.resolve()
        }
    }

    // MARK: - Torch / Zoom

    @objc func enableTorch(_ call: CAPPluginCall) {
        guard let device, device.hasTorch else {
            call.reject("Linterna no disponible")
            return
        }
        do {
            try device.lockForConfiguration()
            try device.setTorchModeOn(level: AVCaptureDevice.maxAvailableTorchLevel)
            device.unlockForConfiguration()
            call.resolve()
        } catch {
            call.reject("No se pudo encender la linterna: \(error.localizedDescription)")
        }
    }

    @objc func disableTorch(_ call: CAPPluginCall) {
        guard let device, device.hasTorch else {
            call.resolve()
            return
        }
        do {
            try device.lockForConfiguration()
            device.torchMode = .off
            device.unlockForConfiguration()
            call.resolve()
        } catch {
            call.reject("No se pudo apagar la linterna: \(error.localizedDescription)")
        }
    }

    @objc func isTorchAvailable(_ call: CAPPluginCall) {
        let available = device?.hasTorch == true && device?.isTorchAvailable == true
        call.resolve(["available": available])
    }

    @objc func setZoomRatio(_ call: CAPPluginCall) {
        guard let device else {
            call.reject("Cámara no iniciada")
            return
        }
        let requested = call.getDouble("zoomRatio") ?? 1.0
        let maxZoom = min(device.activeFormat.videoMaxZoomFactor, 8.0)
        let target = max(1.0, min(maxZoom, CGFloat(requested)))
        do {
            try device.lockForConfiguration()
            device.videoZoomFactor = target
            device.unlockForConfiguration()
            call.resolve()
        } catch {
            call.reject("No se pudo aplicar zoom: \(error.localizedDescription)")
        }
    }

    @objc func getMaxZoomRatio(_ call: CAPPluginCall) {
        guard let device else {
            call.resolve(["zoomRatio": 1.0])
            return
        }
        call.resolve(["zoomRatio": Double(min(device.activeFormat.videoMaxZoomFactor, 8.0))])
    }

    // MARK: - Galería

    @objc func scanImage(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else {
            call.reject("Falta path")
            return
        }
        let url: URL
        if path.hasPrefix("file://"), let parsed = URL(string: path) {
            url = parsed
        } else {
            url = URL(fileURLWithPath: path)
        }
        guard let image = UIImage(contentsOfFile: url.path), let cgImage = image.cgImage else {
            call.reject("No se pudo leer la imagen")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let request = VNDetectBarcodesRequest()
            request.symbologies = [.qr]
            let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
            do {
                try handler.perform([request])
                let results = (request.results ?? []).compactMap { $0.payloadStringValue }
                call.resolve(["barcodes": results.map { ["rawValue": $0] }])
            } catch {
                call.reject("No se pudo leer el código: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Vision

    public func captureOutput(_ output: AVCaptureOutput,
                              didOutput sampleBuffer: CMSampleBuffer,
                              from connection: AVCaptureConnection) {
        guard isScanning else { return }
        // Throttle: como máximo ~12 eventos/segundo.
        if Date().timeIntervalSince(lastEmit) < 0.08 { return }
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        let request = VNDetectBarcodesRequest()
        request.symbologies = [.qr]
        let orientation = Self.cgOrientation(from: connection.videoOrientation)
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: orientation, options: [:])

        do {
            try handler.perform([request])
        } catch {
            return
        }

        guard let observations = request.results, !observations.isEmpty else { return }

        var payloads: [[String: Any]] = []
        for observation in observations {
            guard observation.symbology == .qr, let raw = observation.payloadStringValue else { continue }
            var corners: [[Double]] = []
            let points = [observation.topLeft, observation.topRight, observation.bottomRight, observation.bottomLeft]
            for point in points {
                if let converted = convertToScreen(normalized: point) {
                    corners.append([Double(converted.x), Double(converted.y)])
                }
            }
            payloads.append([
                "rawValue": raw,
                "format": "QR_CODE",
                "cornerPoints": corners
            ])
        }

        guard !payloads.isEmpty else { return }
        lastEmit = Date()
        DispatchQueue.main.async {
            self.notifyListeners("barcodesScanned", data: ["barcodes": payloads])
        }
    }

    /// Vision entrega puntos normalizados con origen abajo-izquierda; el layer
    /// los convierte a puntos de vista respetando el aspect fill.
    private func convertToScreen(normalized point: CGPoint) -> CGPoint? {
        guard let layer = previewLayer else { return nil }
        let devicePoint = CGPoint(x: point.x, y: 1.0 - point.y)
        return layer.layerPointConverted(fromCaptureDevicePoint: devicePoint)
    }

    static func cgOrientation(from orientation: AVCaptureVideoOrientation) -> CGImagePropertyOrientation {
        switch orientation {
        case .portrait: return .right
        case .portraitUpsideDown: return .left
        case .landscapeLeft: return .up
        case .landscapeRight: return .down
        @unknown default: return .right
        }
    }
}
