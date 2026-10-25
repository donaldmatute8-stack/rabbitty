import UIKit
import MapKit
import Capacitor

// MARK: - Modelos de Datos para Pines Rabbitty
public struct RabbittyBusinessItem: Codable {
    public let id: String
    public let name: String
    public let category: String?
    public let lat: Double
    public let lng: Double
    public let rewardPercentage: Int
    public let givesBunz: Bool
    public let acceptsBunz: Bool
}

// MARK: - Anotación Personalizada en MapKit
public class RabbittyAnnotation: NSObject, MKAnnotation {
    public let coordinate: CLLocationCoordinate2D
    public let business: RabbittyBusinessItem
    public var title: String? { business.name }
    public var subtitle: String? { "+\(business.rewardPercentage)% Bunz" }

    public init(business: RabbittyBusinessItem) {
        self.business = business
        self.coordinate = CLLocationCoordinate2D(latitude: business.lat, longitude: business.lng)
        super.init()
    }
}

// MARK: - Anotación Visual Personalizada (Pines Neón Rabbitty)
public class RabbittyAnnotationView: MKAnnotationView {
    public static let reuseIdentifier = "RabbittyPin"

    private let containerView = UIView()
    private let iconLabel = UILabel()
    private let badgeLabel = UILabel()

    public override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        setupViews()
    }

    public required init?(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
        setupViews()
    }

    private func setupViews() {
        canShowCallout = false
        frame = CGRect(x: 0, y: 0, width: 50, height: 60)

        // Contenedor Circular
        containerView.frame = CGRect(x: 5, y: 15, width: 40, height: 40)
        containerView.layer.cornerRadius = 20
        containerView.layer.borderWidth = 2.5
        containerView.layer.masksToBounds = false
        containerView.backgroundColor = UIColor(white: 0.08, alpha: 0.95)

        // Emoji / Icono
        iconLabel.frame = containerView.bounds
        iconLabel.textAlignment = .center
        iconLabel.font = UIFont.systemFont(ofSize: 18)
        containerView.addSubview(iconLabel)

        // Badge Superior de Recompensa Bunz (+10%, +15%, etc.)
        badgeLabel.frame = CGRect(x: 2, y: 0, width: 46, height: 16)
        badgeLabel.layer.cornerRadius = 8
        badgeLabel.layer.masksToBounds = true
        badgeLabel.textAlignment = .center
        badgeLabel.font = UIFont.boldSystemFont(ofSize: 9)
        badgeLabel.textColor = .white

        addSubview(containerView)
        addSubview(badgeLabel)
    }

    public func configure(with business: RabbittyBusinessItem, isSelected: Bool) {
        // Color por rareza según recompensa Bunz
        let color: UIColor
        if business.rewardPercentage >= 15 {
            color = UIColor(red: 1.0, green: 0.82, blue: 0.4, alpha: 1.0) // Legendario #FFD166
        } else if business.rewardPercentage >= 10 {
            color = UIColor(red: 1.0, green: 0.3, blue: 0.55, alpha: 1.0) // Épico #FF4D8D
        } else if business.rewardPercentage >= 5 {
            color = UIColor(red: 0.71, green: 0.48, blue: 0.93, alpha: 1.0) // Raro #B57BEE
        } else {
            color = UIColor(red: 0.49, green: 0.78, blue: 0.89, alpha: 1.0) // Común #7EC8E3
        }

        containerView.layer.borderColor = color.cgColor
        containerView.layer.shadowColor = color.cgColor
        containerView.layer.shadowRadius = isSelected ? 12 : 6
        containerView.layer.shadowOpacity = isSelected ? 0.9 : 0.6
        containerView.layer.shadowOffset = .zero

        badgeLabel.backgroundColor = color
        badgeLabel.textColor = business.rewardPercentage >= 15 ? .black : .white
        badgeLabel.text = "+\(business.rewardPercentage)%"

        // Icono según categoría
        let cat = (business.category ?? "").lowercased()
        if cat.contains("caf") {
            iconLabel.text = "☕"
        } else if cat.contains("restaurante") || cat.contains("comida") || cat.contains("pizz") {
            iconLabel.text = "🍕"
        } else if cat.contains("fit") || cat.contains("gym") {
            iconLabel.text = "💪"
        } else if cat.contains("tech") {
            iconLabel.text = "💻"
        } else if cat.contains("bar") || cat.contains("copas") {
            iconLabel.text = "🍸"
        } else {
            iconLabel.text = "🛍️"
        }

        transform = isSelected ? CGAffineTransform(scaleX: 1.15, y: 1.15) : .identity
    }
}

// MARK: - Vista Contenedora del Mapa Nativo
public class RabbittyNativeMapView: UIView, MKMapViewDelegate {
    public let mapView = MKMapView()
    public var onSelectBusiness: ((String) -> Void)?

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupMap()
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupMap()
    }

    private func setupMap() {
        mapView.frame = bounds
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        mapView.delegate = self
        mapView.showsUserLocation = true
        mapView.showsCompass = true
        mapView.showsScale = true
        mapView.pointOfInterestFilter = .excludingAll // Sin ruido de comercios no afiliados

        // Forzar Modo Oscuro elegante de Apple
        mapView.overrideUserInterfaceStyle = .dark

        addSubview(mapView)
    }

    public func setBusinesses(_ list: [RabbittyBusinessItem]) {
        mapView.removeAnnotations(mapView.annotations)
        let annotations = list.map { RabbittyAnnotation(business: $0) }
        mapView.addAnnotations(annotations)

        if let first = list.first {
            centerOn(lat: first.lat, lng: first.lng, radiusKm: 3.5)
        }
    }

    public func centerOn(lat: Double, lng: Double, radiusKm: Double = 2.0) {
        let center = CLLocationCoordinate2D(latitude: lat, longitude: lng)
        let region = MKCoordinateRegion(
            center: center,
            latitudinalMeters: radiusKm * 1000,
            longitudinalMeters: radiusKm * 1000
        )
        mapView.setRegion(region, animated: true)
    }

    // MARK: - MKMapViewDelegate
    public func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
        guard let rabbitAnnotation = annotation as? RabbittyAnnotation else {
            return nil // Usar vista default para userLocation
        }

        var view = mapView.dequeueReusableAnnotationView(withIdentifier: RabbittyAnnotationView.reuseIdentifier) as? RabbittyAnnotationView
        if view == nil {
            view = RabbittyAnnotationView(annotation: rabbitAnnotation, reuseIdentifier: RabbittyAnnotationView.reuseIdentifier)
        } else {
            view?.annotation = rabbitAnnotation
        }

        view?.configure(with: rabbitAnnotation.business, isSelected: false)
        return view
    }

    public func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
        guard let rabbitView = view as? RabbittyAnnotationView,
              let annot = rabbitView.annotation as? RabbittyAnnotation else { return }

        rabbitView.configure(with: annot.business, isSelected: true)
        onSelectBusiness?(annot.business.id)
    }

    public func mapView(_ mapView: MKMapView, didDeselect view: MKAnnotationView) {
        guard let rabbitView = view as? RabbittyAnnotationView,
              let annot = rabbitView.annotation as? RabbittyAnnotation else { return }

        rabbitView.configure(with: annot.business, isSelected: false)
    }
}
