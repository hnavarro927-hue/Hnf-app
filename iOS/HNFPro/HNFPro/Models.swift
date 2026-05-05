import Foundation
import SwiftData

@Model
final class ClientRecord {
    var id: String
    var nombre: String
    var estado: String
    init(id: String, nombre: String, estado: String) {
        self.id = id; self.nombre = nombre; self.estado = estado
    }
}

struct BundlePayload: Codable {
    let clients: [Client]
    let branchesOrStores: [Branch]
    let contracts: [Contract]
    let ui_flags: UIFlags?
}
struct Client: Codable, Identifiable { let id: String; let nombre: String; let estado: String }
struct Branch: Codable, Identifiable { let id: String; let clientId: String; let nombre: String; let notas: String? }
struct Contract: Codable, Identifiable { let id: String; let clientId: String; let nombreContrato: String; let frecuenciaFacturacion: String?; let ultimaMantencion: String? }
struct UIFlags: Codable { let iaFlotanteVisible: Bool; let archivosInteligentes: [String]; let dashboard: [String] }

@Observable
final class HNFDataStore {
    var payload: BundlePayload?
    var error: String?
    init() { load() }
    func load() {
        guard let url = Bundle.main.url(forResource: "hnf-master-bundle.real", withExtension: "json") else {
            error = "No se encontró hnf-master-bundle.real.json"
            return
        }
        do {
            payload = try JSONDecoder().decode(BundlePayload.self, from: Data(contentsOf: url))
            validate()
        } catch { error = error.localizedDescription }
    }
    private func validate() {
        guard let payload else { return }
        let nombres = payload.clients.map(\.nombre)
        precondition(!nombres.contains(where: { $0.localizedCaseInsensitiveContains("Dominion") || $0.localizedCaseInsensitiveContains("Domion") }))
        precondition(!nombres.contains(where: { $0.localizedCaseInsensitiveContains("Colegio") || $0.localizedCaseInsensitiveContains("Leoncito") }))
    }
}
