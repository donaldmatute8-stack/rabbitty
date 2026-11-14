import Foundation
import Capacitor
import Speech
import AVFoundation

/// Plugin local de dictado para iOS.
///
/// La app usa SPM y el plugin de la comunidad es CocoaPods-only, por eso no
/// entraba al build. Este puente usa SFSpeechRecognizer + AVAudioEngine y se
/// registra en `RabbittyBridgeViewController.capacitorDidLoad()`.
///
/// JS: `RabbittySpeech.available()`, `.start({ language, prompt })`, `.stop()`.
@objc(RabbittySpeechPlugin)
public class RabbittySpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RabbittySpeechPlugin"
    public let jsName = "RabbittySpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var currentCall: CAPPluginCall?
    private var didInstallTap = false

    /// Cierre por silencio: se reinicia con cada resultado parcial y, si la
    /// persona deja de hablar, se manda `endAudio()` para forzar el final.
    private var silenceTimer: Timer?
    private var hardCapTimer: Timer?
    private var lastTranscript: String = ""

    @objc func available(_ call: CAPPluginCall) {
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "es-MX"))
        call.resolve(["available": recognizer?.isAvailable ?? false])
    }

    @objc func start(_ call: CAPPluginCall) {
        stopRecognition()

        let locale = call.getString("language") ?? "es-MX"
        SFSpeechRecognizer.requestAuthorization { [weak self] speechStatus in
            guard let self = self else { return }
            guard speechStatus == .authorized else {
                DispatchQueue.main.async {
                    call.reject(speechStatus == .denied ? "PERMISSION_DENIED" : "PERMISSION_PROMPT")
                }
                return
            }
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                guard granted else {
                    DispatchQueue.main.async { call.reject("MIC_PERMISSION_DENIED") }
                    return
                }
                DispatchQueue.main.async {
                    self.beginRecognition(call, locale: locale)
                }
            }
        }
    }

    private func beginRecognition(_ call: CAPPluginCall, locale: String) {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)), recognizer.isAvailable else {
            call.reject("SPEECH_NOT_AVAILABLE")
            return
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            call.reject("AUDIO_SESSION_ERROR")
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
        didInstallTap = true

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            stopRecognition()
            call.reject("AUDIO_ENGINE_ERROR")
            return
        }

        currentCall = call
        lastTranscript = ""
        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }
            if let result = result {
                let text = result.bestTranscription.formattedString
                if !text.isEmpty { self.lastTranscript = text }
                if result.isFinal {
                    self.finish(text: text, error: nil)
                    return
                }
                // Mientras siga llegando texto, se reinicia el contador de silencio.
                self.armSilenceTimer()
            } else if let error = error {
                self.finish(text: self.lastTranscript.isEmpty ? nil : self.lastTranscript, error: error.localizedDescription)
            }
        }

        // Tope duro: nunca dejar el micrófono abierto más de 15 s.
        hardCapTimer?.invalidate()
        hardCapTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: false) { [weak self] _ in
            self?.stopListeningAndFinish()
        }
        armSilenceTimer(initial: true)
    }

    /// Si hay 1.4 s sin novedades, se cierra la captura y el reconocedor finaliza.
    private func armSilenceTimer(initial: Bool = false) {
        silenceTimer?.invalidate()
        // 4 s de gracia para empezar a hablar; 1.4 s entre avances del dictado.
        let delay: TimeInterval = initial ? 4.0 : 1.4
        silenceTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.stopListeningAndFinish()
        }
    }

    private func stopListeningAndFinish() {
        guard currentCall != nil else { return }
        silenceTimer?.invalidate()
        silenceTimer = nil
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if didInstallTap {
            audioEngine.inputNode.removeTap(onBus: 0)
            didInstallTap = false
        }
        // endAudio deja que el reconocedor entregue el resultado final.
        recognitionRequest?.endAudio()
    }

    @objc func stop(_ call: CAPPluginCall) {
        // Cierre manual (el usuario toca el micrófono): se entrega lo último
        // escuchado en lugar de tirarlo.
        stopListeningAndFinish()
        let partial = lastTranscript
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) { [weak self] in
            guard let self = self, self.currentCall != nil else { return }
            // Si el resultado final no llegó, se resuelve con lo último escuchado.
            self.finish(text: self.lastTranscript.isEmpty ? (partial.isEmpty ? nil : partial) : self.lastTranscript, error: nil)
        }
    }

    private func finish(text: String?, error: String?) {
        guard let call = currentCall else { return }
        currentCall = nil
        stopRecognition()
        if let error = error {
            call.reject(error)
        } else {
            call.resolve(["matches": text.map { [$0] } ?? []])
        }
    }

    private func stopRecognition() {
        silenceTimer?.invalidate()
        silenceTimer = nil
        hardCapTimer?.invalidate()
        hardCapTimer = nil
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if didInstallTap {
            audioEngine.inputNode.removeTap(onBus: 0)
            didInstallTap = false
        }
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
