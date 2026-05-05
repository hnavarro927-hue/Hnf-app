import SwiftUI
import SwiftData

@main
struct HNFProApp: App {
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([ClientRecord.self])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do { return try ModelContainer(for: schema, configurations: [config]) }
        catch { fatalError("ModelContainer error: \(error)") }
    }()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(HNFDataStore())
        }
        .modelContainer(sharedModelContainer)
    }
}
