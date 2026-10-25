import Foundation
import Capacitor
import UIKit

@objc(RabbittyMapPlugin)
public class RabbittyMapPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RabbittyMapPlugin"
    public let jsName = "RabbittyMap"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "showMap", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideMap", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBusinesses", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "centerOn", returnType: CAPPluginReturnPromise)
    ]

    private var nativeMapView: RabbittyNativeMapView?

    @objc public func showMap(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let bridge = self.bridge, let webView = bridge.webView else {
                call.reject("Bridge not available")
                return
            }

            if self.nativeMapView == nil {
                let map = RabbittyNativeMapView(frame: webView.bounds)
                map.onSelectBusiness = { [weak self] businessId in
                    self?.notifyListeners("onBusinessSelected", data: ["businessId": businessId])
                }

                // Colocar la vista nativa detrás de la WebView para permitir overlays HTML semitransparentes
                webView.isOpaque = false
                webView.backgroundColor = .clear
                webView.scrollView.backgroundColor = .clear
                webView.superview?.insertSubview(map, belowSubview: webView)
                self.nativeMapView = map
            } else {
                self.nativeMapView?.isHidden = false
            }

            call.resolve(["success": true])
        }
    }

    @objc public func hideMap(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.nativeMapView?.isHidden = true
            call.resolve(["success": true])
        }
    }

    @objc public func setBusinesses(_ call: CAPPluginCall) {
        guard let list = call.getArray("businesses", [String: Any].self) else {
            call.reject("Must provide businesses array")
            return
        }

        var parsed: [RabbittyBusinessItem] = []
        for item in list {
            guard let id = item["id"] as? String,
                  let name = item["name"] as? String else { continue }

            let lat: Double
            if let d = item["lat"] as? Double { lat = d }
            else if let s = item["lat"] as? String, let d = Double(s) { lat = d }
            else { continue }

            let lng: Double
            if let d = item["lng"] as? Double { lng = d }
            else if let s = item["lng"] as? String, let d = Double(s) { lng = d }
            else { continue }

            let reward = item["rewardPercentage"] as? Int ?? item["reward_percentage"] as? Int ?? 10
            let gives = item["givesBunz"] as? Bool ?? true
            let accepts = item["acceptsBunz"] as? Bool ?? true
            let cat = item["category"] as? String

            parsed.append(RabbittyBusinessItem(
                id: id,
                name: name,
                category: cat,
                lat: lat,
                lng: lng,
                rewardPercentage: reward,
                givesBunz: gives,
                acceptsBunz: accepts
            ))
        }

        DispatchQueue.main.async { [weak self] in
            self?.nativeMapView?.setBusinesses(parsed)
            call.resolve(["count": parsed.count])
        }
    }

    @objc public func centerOn(_ call: CAPPluginCall) {
        guard let lat = call.getDouble("lat"), let lng = call.getDouble("lng") else {
            call.reject("lat and lng are required")
            return
        }
        let radius = call.getDouble("radiusKm") ?? 2.0

        DispatchQueue.main.async { [weak self] in
            self?.nativeMapView?.centerOn(lat: lat, lng: lng, radiusKm: radius)
            call.resolve(["success": true])
        }
    }
}
