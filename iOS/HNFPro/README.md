# HNF Pro iOS

## Preflight automático ya validado en repo
- Bundle ID: `cl.hnf.hnfpro`
- Deployment target: iOS `17.0`
- Devices: Universal `iPhone/iPad` (`TARGETED_DEVICE_FAMILY=1,2`)
- Un solo `@main`
- Recurso `hnf-master-bundle.real.json` en Copy Bundle Resources
- AppIcon y LaunchScreen configurados

## Abrir y correr
1. Abrir `iOS/HNFPro/HNFPro.xcodeproj`.
2. Seleccionar scheme compartido `HNFPro`.
3. Elegir simulador iPhone o iPad.
4. Run (`⌘R`) o Build (`⌘B`).

## Comandos xcodebuild (Mac)
```bash
cd iOS/HNFPro
xcodebuild -project HNFPro.xcodeproj -scheme HNFPro -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 16' build
xcodebuild -project HNFPro.xcodeproj -scheme HNFPro -configuration Debug -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M4)' build
```

## Archive / TestFlight
```bash
cd iOS/HNFPro
xcodebuild -project HNFPro.xcodeproj -scheme HNFPro -configuration Release -destination generic/platform=iOS -archivePath build/HNFPro.xcarchive archive
xcodebuild -exportArchive -archivePath build/HNFPro.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath build/export
```

Luego subir desde Xcode Organizer o Transporter a App Store Connect (TestFlight).
