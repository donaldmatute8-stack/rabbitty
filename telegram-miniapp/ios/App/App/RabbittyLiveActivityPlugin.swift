//
//  RabbittyLiveActivityPlugin.swift
//  Puente JS ↔ ActivityKit para el seguimiento de pedidos en la pantalla de
//  bloqueo / Dynamic Island.
//
//  JS: `RabbittyLiveActivity.start|update|end|isSupported` (ver src/lib/liveActivity.ts).
//  El token de push de la actividad se emite por el evento `pushToken` para que
//  el servidor pueda refrescarla aunque la app esté suspendida.
//

import Foundation
import Capacitor
import ActivityKit

@objc(RabbittyLiveActivityPlugin)
public class RabbittyLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RabbittyLiveActivityPlugin"
    public let jsName = "RabbittyLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endAll", returnType: CAPPluginReturnPromise),
    ]

    private var tokenTasks: [String: Task<Void, Never>] = [:]

    // MARK: - Helpers

    @available(iOS 16.1, *)
    private func activity(for orderId: String) -> Activity<RabbittyOrderActivityAttributes>? {
        Activity<RabbittyOrderActivityAttributes>.activities.first {
            $0.attributes.orderId == orderId
        }
    }

    @available(iOS 16.1, *)
    private func state(from call: CAPPluginCall) -> RabbittyOrderActivityAttributes.ContentState {
        RabbittyOrderActivityAttributes.ContentState(
            stage: call.getString("stage") ?? "RECEIVED",
            stageLabel: call.getString("stageLabel") ?? "Pedido recibido",
            step: call.getInt("step") ?? 0,
            stepCount: call.getInt("stepCount") ?? 4,
            total: call.getDouble("total") ?? 0,
            itemsSummary: call.getString("itemsSummary") ?? ""
        )
    }

    /// Observa los tokens de push de la actividad y los reenvía a JS.
    @available(iOS 16.1, *)
    private func observePushToken(_ activity: Activity<RabbittyOrderActivityAttributes>, orderId: String) {
        tokenTasks[orderId]?.cancel()
        tokenTasks[orderId] = Task { [weak self] in
            for await tokenData in activity.pushTokenUpdates {
                let token = tokenData.map { String(format: "%02x", $0) }.joined()
                self?.notifyListeners("pushToken", data: [
                    "orderId": orderId,
                    "token": token,
                ])
            }
        }
    }

    // MARK: - API

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve([
                "supported": ActivityAuthorizationInfo().areActivitiesEnabled,
                "platform": "ios",
            ])
        } else {
            call.resolve(["supported": false, "platform": "ios"])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities requiere iOS 16.2+")
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("El usuario desactivó Live Activities")
            return
        }
        guard let orderId = call.getString("orderId"), !orderId.isEmpty else {
            call.reject("orderId requerido")
            return
        }

        let attributes = RabbittyOrderActivityAttributes(
            orderId: orderId,
            businessName: call.getString("businessName") ?? "Rabbitty",
            orderType: call.getString("orderType") ?? "TO_GO"
        )
        let content = ActivityContent(
            state: state(from: call),
            staleDate: Date().addingTimeInterval(60 * 60)
        )

        // Idempotente: si ya existe la actividad de este pedido, se actualiza.
        if let existing = activity(for: orderId) {
            Task {
                await existing.update(content)
                self.observePushToken(existing, orderId: orderId)
                call.resolve(["started": false, "updated": true, "activityId": existing.id])
            }
            return
        }

        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: content,
                pushType: .token
            )
            observePushToken(activity, orderId: orderId)
            call.resolve(["started": true, "activityId": activity.id])
        } catch {
            call.reject("No se pudo iniciar la Live Activity: \(error.localizedDescription)")
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities requiere iOS 16.2+")
            return
        }
        guard let orderId = call.getString("orderId") else {
            call.reject("orderId requerido")
            return
        }
        guard let existing = activity(for: orderId) else {
            call.resolve(["updated": false, "reason": "not_found"])
            return
        }
        let content = ActivityContent(
            state: state(from: call),
            staleDate: Date().addingTimeInterval(60 * 60)
        )
        Task {
            await existing.update(content)
            call.resolve(["updated": true])
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ended": false])
            return
        }
        guard let orderId = call.getString("orderId") else {
            call.reject("orderId requerido")
            return
        }
        guard let existing = activity(for: orderId) else {
            call.resolve(["ended": false, "reason": "not_found"])
            return
        }
        let finalState = state(from: call)
        tokenTasks[orderId]?.cancel()
        tokenTasks[orderId] = nil
        Task {
            await existing.end(
                ActivityContent(state: finalState, staleDate: nil),
                dismissalPolicy: .after(Date().addingTimeInterval(60 * 5))
            )
            call.resolve(["ended": true])
        }
    }

    @objc func endAll(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ended": 0])
            return
        }
        let activities = Activity<RabbittyOrderActivityAttributes>.activities
        Task {
            for item in activities {
                await item.end(nil, dismissalPolicy: .immediate)
            }
            self.tokenTasks.values.forEach { $0.cancel() }
            self.tokenTasks.removeAll()
            call.resolve(["ended": activities.count])
        }
    }
}
