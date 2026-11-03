//
//  RabbittyOrderLiveActivity.swift
//  Tarjeta "viva" del pedido en la pantalla de bloqueo y en la Dynamic Island.
//
//  Diseño: fondo oscuro con acento rosa Rabbitty, etapa actual, barra de
//  progreso y total. Tocar abre el pedido (deep link rabbitty://).
//

import ActivityKit
import WidgetKit
import SwiftUI

private let rabbittyPink = Color(red: 0.913, green: 0.118, blue: 0.388) // #E91E63
private let rabbittyAmber = Color(red: 1.0, green: 0.541, blue: 0.0)    // #FF8A00

@available(iOS 17.0, *)
private func stageSymbol(_ stage: String) -> String {
    switch stage {
    case "PAYMENT_PENDING": return "creditcard.fill"
    case "PREPARING": return "flame.fill"
    case "READY": return "checkmark.circle.fill"
    case "DONE": return "party.popper.fill"
    default: return "bag.fill"
    }
}

@available(iOS 17.0, *)
private func progressFraction(_ state: RabbittyOrderActivityAttributes.ContentState) -> Double {
    let count = max(1, state.stepCount - 1)
    let value = Double(max(0, min(state.step, count))) / Double(count)
    return value
}

@available(iOS 17.0, *)
struct RabbittyOrderLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RabbittyOrderActivityAttributes.self) { context in
            // ── Pantalla de bloqueo / banner ──
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(rabbittyPink.opacity(0.18))
                        Image(systemName: stageSymbol(context.state.stage))
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(rabbittyPink)
                    }
                    .frame(width: 34, height: 34)

                    VStack(alignment: .leading, spacing: 1) {
                        Text(context.state.stageLabel.uppercased())
                            .font(.system(size: 10, weight: .heavy))
                            .tracking(1.1)
                            .foregroundStyle(rabbittyPink)
                        Text(context.attributes.businessName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 6)

                    Text(String(format: "$%.0f MXN", context.state.total))
                        .font(.system(size: 13, weight: .heavy))
                        .foregroundStyle(.white.opacity(0.85))
                }

                ProgressView(value: progressFraction(context.state))
                    .tint(rabbittyPink)
                    .background(Color.white.opacity(0.12))

                if !context.state.itemsSummary.isEmpty {
                    Text(context.state.itemsSummary)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.55))
                        .lineLimit(1)
                }

                HStack(spacing: 5) {
                    Text("Etapa \(min(context.state.step + 1, max(1, context.state.stepCount))) de \(max(1, context.state.stepCount))")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.45))
                    Spacer()
                    Image(systemName: "rabbit.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(.white.opacity(0.35))
                    Text("Rabbitty")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white.opacity(0.35))
                }
            }
            .padding(14)
            .activityBackgroundTint(Color(red: 0.043, green: 0.043, blue: 0.067))
            .activitySystemActionForegroundColor(.white)
            .widgetURL(URL(string: "rabbitty://order/\(context.attributes.orderId)"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: stageSymbol(context.state.stage))
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(rabbittyPink)
                        Text(context.state.stageLabel)
                            .font(.system(size: 12, weight: .heavy))
                            .foregroundStyle(.white)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(String(format: "$%.0f", context.state.total))
                        .font(.system(size: 13, weight: .heavy))
                        .foregroundStyle(rabbittyAmber)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(context.attributes.businessName)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                        ProgressView(value: progressFraction(context.state))
                            .tint(rabbittyPink)
                        if !context.state.itemsSummary.isEmpty {
                            Text(context.state.itemsSummary)
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(.white.opacity(0.6))
                                .lineLimit(1)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: stageSymbol(context.state.stage))
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(rabbittyPink)
            } compactTrailing: {
                Text(String(format: "$%.0f", context.state.total))
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(rabbittyAmber)
            } minimal: {
                Image(systemName: stageSymbol(context.state.stage))
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(rabbittyPink)
            }
            .widgetURL(URL(string: "rabbitty://order/\(context.attributes.orderId)"))
            .keylineTint(rabbittyPink)
        }
    }
}
