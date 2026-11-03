//
//  RabbittyOrderActivityAttributes.swift
//  Contrato del Live Activity de pedidos (compartido App ↔ Widget Extension).
//
//  Lo que se ve en la pantalla de bloqueo / Dynamic Island mientras el pedido
//  está en curso. El `ContentState` es lo único que cambia entre etapas
//  (Recibido → Preparando → Listo → Entregado).
//

import Foundation
#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.1, *)
public struct RabbittyOrderActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// RECEIVED | PREPARING | READY | DONE | PAYMENT_PENDING
        public var stage: String
        public var stageLabel: String
        public var step: Int
        public var stepCount: Int
        public var total: Double
        public var itemsSummary: String

        public init(
            stage: String,
            stageLabel: String,
            step: Int,
            stepCount: Int,
            total: Double,
            itemsSummary: String
        ) {
            self.stage = stage
            self.stageLabel = stageLabel
            self.step = step
            self.stepCount = stepCount
            self.total = total
            self.itemsSummary = itemsSummary
        }
    }

    /// Identidad del pedido (no cambia durante la vida de la actividad).
    public var orderId: String
    public var businessName: String
    public var orderType: String

    public init(orderId: String, businessName: String, orderType: String) {
        self.orderId = orderId
        self.businessName = businessName
        self.orderType = orderType
    }
}
#endif
