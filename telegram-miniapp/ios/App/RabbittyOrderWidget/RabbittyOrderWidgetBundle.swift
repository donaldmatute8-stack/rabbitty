//
//  RabbittyOrderWidgetBundle.swift
//  Punto de entrada de la Widget Extension (Live Activity de pedidos).
//

import WidgetKit
import SwiftUI

@main
struct RabbittyOrderWidgetBundle: WidgetBundle {
    var body: some Widget {
        RabbittyOrderLiveActivity()
    }
}
