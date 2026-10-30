import Foundation
import Capacitor
import UIKit
import WebKit

@objc(RabbittyMapPlugin)
public class RabbittyMapPlugin: CAPPlugin, CAPBridgedPlugin, UIGestureRecognizerDelegate {
    public let identifier = "RabbittyMapPlugin"
    public let jsName = "RabbittyMap"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "showMap", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideMap", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBusinesses", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "centerOn", returnType: CAPPluginReturnPromise)
    ]

    private var nativeMapView: RabbittyNativeMapView?
    private var panRecognizer: UIPanGestureRecognizer?
    private var pinchRecognizer: UIPinchGestureRecognizer?
    private var tapRecognizer: UITapGestureRecognizer?

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

                // Attach touch forwarding gestures to webView so native map receives pan, pinch and pin taps
                self.setupTouchForwarding(on: webView, targetMap: map)
            } else {
                self.nativeMapView?.isHidden = false
            }

            call.resolve(["success": true])
        }
    }

    private func setupTouchForwarding(on webView: WKWebView, targetMap: RabbittyNativeMapView) {
        // Forward gestures when user interacts with transparent webview areas
        let pan = UIPanGestureRecognizer(target: self, action: #selector(handleMapPan(_:)))
        pan.cancelsTouchesInView = false
        pan.delegate = self
        webView.addGestureRecognizer(pan)
        self.panRecognizer = pan

        let pinch = UIPinchGestureRecognizer(target: self, action: #selector(handleMapPinch(_:)))
        pinch.cancelsTouchesInView = false
        pinch.delegate = self
        webView.addGestureRecognizer(pinch)
        self.pinchRecognizer = pinch

        let tap = UITapGestureRecognizer(target: self, action: #selector(handleMapTap(_:)))
        tap.cancelsTouchesInView = false
        tap.delegate = self
        webView.addGestureRecognizer(tap)
        self.tapRecognizer = tap
    }

    @objc private func handleMapPan(_ gesture: UIPanGestureRecognizer) {
        guard let map = nativeMapView?.mapView else { return }
        let translation = gesture.translation(in: map)
        if gesture.state == .changed {
            var center = map.centerCoordinate
            let span = map.region.span
            center.latitude += (translation.y / map.bounds.height) * span.latitudeDelta * 0.5
            center.longitude -= (translation.x / map.bounds.width) * span.longitudeDelta * 0.5
            map.setCenter(center, animated: false)
            gesture.setTranslation(.zero, in: map)
        }
    }

    @objc private func handleMapPinch(_ gesture: UIPinchGestureRecognizer) {
        guard let map = nativeMapView?.mapView else { return }
        if gesture.state == .changed {
            let scale = gesture.scale
            var region = map.region
            region.span.latitudeDelta /= Double(scale)
            region.span.longitudeDelta /= Double(scale)
            map.setRegion(region, animated: false)
            gesture.scale = 1.0
        }
    }

    @objc private func handleMapTap(_ gesture: UITapGestureRecognizer) {
        guard let map = nativeMapView?.mapView else { return }
        for annot in map.annotations {
            if let annotView = map.view(for: annot) {
                let annotPoint = gesture.location(in: annotView)
                if annotView.bounds.contains(annotPoint) {
                    map.selectAnnotation(annot, animated: true)
                    if let rabbitAnnot = annot as? RabbittyAnnotation {
                        self.notifyListeners("onBusinessSelected", data: ["businessId": rabbitAnnot.business.id])
                    }
                    return
                }
            }
        }
    }

    public func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        return true
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
