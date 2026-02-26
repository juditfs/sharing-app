import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    private let statusLabel = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        
        view.backgroundColor = UIColor(white: 0, alpha: 0.6)
        
        statusLabel.text = "Saving to Sharene..."
        statusLabel.textColor = .white
        statusLabel.font = UIFont.boldSystemFont(ofSize: 16)
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        
        let container = UIView()
        container.backgroundColor = UIColor(white: 0.2, alpha: 0.9)
        container.layer.cornerRadius = 12
        container.translatesAutoresizingMaskIntoConstraints = false
        
        container.addSubview(statusLabel)
        view.addSubview(container)
        
        NSLayoutConstraint.activate([
            container.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            container.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            container.widthAnchor.constraint(greaterThanOrEqualToConstant: 200),
            container.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 20),
            container.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -20),
            container.heightAnchor.constraint(greaterThanOrEqualToConstant: 60),
            
            statusLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -16),
            statusLabel.topAnchor.constraint(equalTo: container.topAnchor, constant: 16),
            statusLabel.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -16)
        ])
        
        handleSharedFile()
    }
    
    private func handleSharedFile() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let itemProviders = extensionItem.attachments else {
            showError("No attachments found")
            return
        }
        
        var foundImage = false
        
        for provider in itemProviders {
            if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                foundImage = true
                provider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { [weak self] (data, error) in
                    guard let self = self else { return }
                    if let data, !data.isEmpty {
                        self.saveToAppGroup(imageData: data, provider: provider, originalFilename: provider.suggestedName)
                    } else {
                        if let error = error {
                            print("[ShareExtension] loadDataRepresentation failed: \(error.localizedDescription)")
                        }
                        self.loadFromFileRepresentation(provider: provider)
                    }
                }
                break // Only process the first image
            }
        }
        
        if !foundImage {
            showError("No compatible image found")
        }
    }

    private func loadFromFileRepresentation(provider: NSItemProvider) {
        provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { [weak self] (url, error) in
            guard let self = self else { return }
            if let error = error {
                DispatchQueue.main.async { self.showError("Load Error: \(error.localizedDescription)") }
                return
            }
            guard let sharedURL = url else {
                DispatchQueue.main.async { self.showError("Could not load image URL") }
                return
            }

            self.saveToAppGroup(sourceURL: sharedURL, provider: provider)
        }
    }

    private func resolvedImageType(from provider: NSItemProvider) -> UTType? {
        for typeIdentifier in provider.registeredTypeIdentifiers {
            if let type = UTType(typeIdentifier), type.conforms(to: .image) {
                return type
            }
        }
        return .jpeg
    }

    private func cacheAppGroupPath(_ path: String) {
        if let defaults = UserDefaults(suiteName: "group.com.sharene.app") {
            defaults.set(path, forKey: "sharene_app_group_path")
            defaults.synchronize()
        }
    }

    private func saveToAppGroup(imageData: Data, provider: NSItemProvider, originalFilename: String?) {
        guard let appGroupContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.sharene.app") else {
            DispatchQueue.main.async {
                self.showError("No App Group access. Check entitlements.")
            }
            print("[ShareExtension] App Group container unavailable")
            return
        }

        cacheAppGroupPath(appGroupContainer.path)
        print("[ShareExtension] App Group container: \(appGroupContainer.path)")

        let uuid = UUID().uuidString
        let imageType = resolvedImageType(from: provider)
        let mimeType = imageType?.preferredMIMEType ?? "image/jpeg"
        let ext = imageType?.preferredFilenameExtension ?? "jpg"
        let imageFilename = "sharene_\(uuid).\(ext)"
        let destURL = appGroupContainer.appendingPathComponent(imageFilename)

        do {
            if FileManager.default.fileExists(atPath: destURL.path) {
                try FileManager.default.removeItem(at: destURL)
            }
            try imageData.write(to: destURL, options: .atomic)

            let metadata: [String: Any] = [
                "version": 1,
                "imagePath": destURL.path,
                "mimeType": mimeType,
                "originalFilename": originalFilename ?? imageFilename,
                "timestamp": ISO8601DateFormatter().string(from: Date())
            ]

            let jsonFilename = "sharene_pending_\(uuid).json"
            let jsonURL = appGroupContainer.appendingPathComponent(jsonFilename)

            let jsonData = try JSONSerialization.data(withJSONObject: metadata, options: .prettyPrinted)
            try jsonData.write(to: jsonURL, options: .atomic)
            print("[ShareExtension] Wrote image: \(destURL.lastPathComponent)")
            print("[ShareExtension] Wrote payload: \(jsonURL.lastPathComponent)")

            DispatchQueue.main.async {
                self.showSuccess()
            }

        } catch {
            DispatchQueue.main.async {
                self.showError("Save failed: \(error.localizedDescription)")
            }
        }
    }
    
    private func saveToAppGroup(sourceURL: URL, provider: NSItemProvider) {
        guard let appGroupContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.sharene.app") else {
            DispatchQueue.main.async {
                self.showError("No App Group access. Check entitlements.")
            }
            print("[ShareExtension] App Group container unavailable")
            return
        }
        cacheAppGroupPath(appGroupContainer.path)
        print("[ShareExtension] App Group container: \(appGroupContainer.path)")
        
        let uuid = UUID().uuidString
        let imageFilename = "sharene_\(uuid).jpg"
        let destURL = appGroupContainer.appendingPathComponent(imageFilename)
        
        do {
            if FileManager.default.fileExists(atPath: destURL.path) {
                try FileManager.default.removeItem(at: destURL)
            }
            try FileManager.default.copyItem(at: sourceURL, to: destURL)
            
            let imageType = resolvedImageType(from: provider)
            let mimeType = imageType?.preferredMIMEType ?? "image/jpeg"
            
            let originalFilename = sourceURL.lastPathComponent
            
            let metadata: [String: Any] = [
                "version": 1,
                "imagePath": destURL.path,
                "mimeType": mimeType,
                "originalFilename": originalFilename,
                "timestamp": ISO8601DateFormatter().string(from: Date())
            ]
            
            let jsonFilename = "sharene_pending_\(uuid).json"
            let jsonURL = appGroupContainer.appendingPathComponent(jsonFilename)
            
            let jsonData = try JSONSerialization.data(withJSONObject: metadata, options: .prettyPrinted)
            try jsonData.write(to: jsonURL)
            print("[ShareExtension] Wrote image: \(destURL.lastPathComponent)")
            print("[ShareExtension] Wrote payload: \(jsonURL.lastPathComponent)")
            
            DispatchQueue.main.async {
                self.showSuccess()
            }
            
        } catch {
            DispatchQueue.main.async {
                self.showError("Save failed: \(error.localizedDescription)")
            }
        }
    }
    
    private func showSuccess() {
        statusLabel.text = "Sent to Sharene ✓"
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.completeRequest()
        }
    }
    
    private func showError(_ msg: String) {
        statusLabel.text = "Error: \(msg)"
        statusLabel.textColor = .systemRed
        // Keep error visible for a few seconds before dismissing
        DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) {
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        }
    }
    
    private func attemptOpenHostApp() {
        let urls = ["sharene://", "com.sharene.app://"].compactMap(URL.init(string:))
        let selectorOpenURL = sel_registerName("openURL:")

        for url in urls {
            print("[ShareExtension] Attempting open URL: \(url.absoluteString)")
            self.extensionContext?.open(url, completionHandler: { success in
                print("[ShareExtension] extensionContext.open(\(url.absoluteString)) success=\(success)")
            })
            var responder: UIResponder? = self as UIResponder
            while responder != nil {
                if responder?.responds(to: selectorOpenURL) == true {
                    responder?.perform(selectorOpenURL, with: url)
                    return
                }
                responder = responder?.next
            }
        }
    }

    private func completeRequest() {
        attemptOpenHostApp()
        self.extensionContext?.completeRequest(returningItems: [], completionHandler: { _ in
            // iOS restricts `extensionContext.open` in Share Extensions.
            // Attempt launch via UIResponder chain after dismissal.
            DispatchQueue.main.async {
                self.attemptOpenHostApp()
            }
        })
    }
}
