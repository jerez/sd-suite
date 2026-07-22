// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AudioBridge",
    platforms: [.macOS(.v12)],
    products: [
        .executable(name: "audio-bridge", targets: ["AudioBridge"])
    ],
    targets: [
        .executableTarget(name: "AudioBridge")
    ]
)
