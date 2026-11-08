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
        request.shouldReportPartialResults = false
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
        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }
            if let result = result, result.isFinal {
                let text = result.bestTranscription.formattedString
                self.finish(text: text, error: nil)
            } else if let error = error {
                self.finish(text: nil, error: error.localizedDescription)
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        stopRecognition()
        call.resolve()
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
