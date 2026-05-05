import SwiftUI

struct RootView: View {
    @Environment(HNFDataStore.self) private var store

    private let modules = ["Dashboard", "Comercial Pro / CRM", "Clientes 2026", "OT Flota", "OT Climatización", "Finanzas", "Costos fijos", "RR.HH.", "Registro de horas", "Sueldos", "Archivos inteligentes", "Reportes", "Ajustes"]

    var body: some View {
        NavigationSplitView {
            List(modules, id: \.self) { module in
                NavigationLink(module, value: module)
            }
            .navigationTitle("HNF Pro")
        } detail: {
            TabView {
                DashboardView().tabItem { Label("Dashboard", systemImage: "chart.bar") }
                Clients2026View().tabItem { Label("Clientes", systemImage: "person.3") }
                SmartFilesView().tabItem { Label("Archivos", systemImage: "folder") }
                PlaceholderView().tabItem { Label("IA", systemImage: "sparkles") }
                ReportsView().tabItem { Label("Reportes", systemImage: "doc.text") }
                SettingsView().tabItem { Label("Ajustes", systemImage: "gear") }
            }
            .overlay(alignment: .bottomTrailing) { FloatingIAButton() }
        }
        .tint(Color.hnfGold)
        .background(Color.hnfGreen)
    }
}

struct DashboardView: View {
    @Environment(HNFDataStore.self) private var store
    let names = ["Hernán Navarro · Gerente Comercial", "Lindsay Astorga · Gerente General"]
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Dashboard Ejecutivo").font(.largeTitle.bold()).foregroundStyle(.white)
                HStack { ForEach(names, id: \.self) { Card(title: $0, value: "Activo") } }
                if let d = store.payload?.ui_flags?.dashboard {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 180))]) {
                        ForEach(d, id: \.self) { Card(title: $0.capitalized, value: "OK") }
                    }
                }
                if let err = store.error { Text(err).foregroundStyle(.red) }
            }.padding()
        }.background(Color.hnfGreen)
    }
}

struct Clients2026View: View {
    @Environment(HNFDataStore.self) private var store
    var body: some View {
        List {
            Section("Activos 2026") {
                ForEach(store.payload?.clients ?? []) { c in Text(c.nombre) }
            }
            Section("Puma") {
                Text("Puma solo Casa Matriz")
                Text("Contrato bimensual")
                Text("Última mantención: abril 2026")
                Text("Pisos: 1, 2, 6 y 13")
                Text("Piso 6 pendiente por eventos del cliente")
            }
        }
    }
}

struct SmartFilesView: View {
    @Environment(HNFDataStore.self) private var store
    var body: some View { List(store.payload?.ui_flags?.archivosInteligentes ?? [], id: \.self) { Text($0) } }
}
struct ReportsView: View { var body: some View { Text("Reportes") } }
struct SettingsView: View { var body: some View { Text("Ajustes") } }
struct FloatingIAButton: View { var body: some View { Image(systemName: "sparkles").padding().background(Color.hnfGold).clipShape(Circle()).shadow(radius: 4).padding() } }
struct Card: View { let title: String; let value: String; var body: some View { VStack(alignment: .leading){Text(title).font(.headline);Text(value)}.padding().frame(maxWidth:.infinity, alignment: .leading).background(Color.white).clipShape(RoundedRectangle(cornerRadius: 12)) } }

extension Color { static let hnfGreen = Color(red: 0.05, green: 0.21, blue: 0.16); static let hnfGold = Color(red: 0.85, green: 0.70, blue: 0.31) }


struct PlaceholderView: View {
    var body: some View {
        List {
            Text("IA flotante: placeholder visible")
            Text("Archivos inteligentes: Manual, Semi automático, Automático futuro")
            Text("Automatización futura: pendiente")
            Text("Integración CloudKit futura: pendiente")
        }
    }
}
