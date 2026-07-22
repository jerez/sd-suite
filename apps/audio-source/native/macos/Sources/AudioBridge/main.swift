import CoreAudio

/// Serializable audio-device model returned to the Node.js layer.
struct AudioDevice: Codable {
    let id: String
    let name: String
    let formFactor: String?
    let transportType: String?
    let isDisabled: Bool?
    let isMuted: Bool?
}

/// Response payload for query/set actions.
struct AudioState: Codable {
    let devices: [AudioDevice]
    let defaultId: String?
}

/// Bridge-level errors mapped to user-friendly stderr messages.
enum BridgeError: Error {
    case invalidDeviceId
    case osStatus(String, OSStatus)
    case unknownAction
}

/// Logical audio scope used to map CoreAudio selectors/properties.
enum AudioScope {
    case output
    case input

    init(_ raw: String) {
        self = raw.lowercased() == "input" ? .input : .output
    }

    var streamScope: AudioObjectPropertyScope {
        switch self {
        case .output: return kAudioDevicePropertyScopeOutput
        case .input: return kAudioDevicePropertyScopeInput
        }
    }

    var defaultDeviceSelector: AudioObjectPropertySelector {
        switch self {
        case .output: return kAudioHardwarePropertyDefaultOutputDevice
        case .input: return kAudioHardwarePropertyDefaultInputDevice
        }
    }

    var unknownName: String {
        switch self {
        case .output: return "Unknown Output"
        case .input: return "Unknown Input"
        }
    }

    var watchQueueLabel: String {
        switch self {
        case .output: return "dev.jerez.sds.audio-source.default-output-watch"
        case .input: return "dev.jerez.sds.audio-source.default-input-watch"
        }
    }
}

/// Throws when a CoreAudio call returns a failing OSStatus.
func check(_ status: OSStatus, _ operation: String) throws {
    guard status == noErr else {
        throw BridgeError.osStatus(operation, status)
    }
}

/// Enumerates all system audio object ids.
func allDeviceIds() throws -> [AudioObjectID] {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDevices,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )

    var propertySize: UInt32 = 0
    try check(
        AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &propertySize),
        "AudioObjectGetPropertyDataSize(kAudioHardwarePropertyDevices)"
    )

    guard propertySize > 0 else {
        return []
    }

    let count = Int(propertySize) / MemoryLayout<AudioObjectID>.size
    var ids = Array(repeating: AudioObjectID(0), count: count)

    try check(
        AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &propertySize, &ids),
        "AudioObjectGetPropertyData(kAudioHardwarePropertyDevices)"
    )

    return ids
}

/// Returns true when the device exposes streams for the requested scope.
func isDevice(_ deviceId: AudioObjectID, scope: AudioScope) -> Bool {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyStreams,
        mScope: scope.streamScope,
        mElement: kAudioObjectPropertyElementMain
    )

    var propertySize: UInt32 = 0
    let status = AudioObjectGetPropertyDataSize(deviceId, &address, 0, nil, &propertySize)
    return status == noErr && propertySize > 0
}

/// Reads a human-readable device name with a safe fallback.
func deviceName(_ deviceId: AudioObjectID, scope: AudioScope) -> String {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioObjectPropertyName,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )

    var nameRef: Unmanaged<CFString>?
    var propertySize = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
    let status = AudioObjectGetPropertyData(deviceId, &address, 0, nil, &propertySize, &nameRef)

    guard status == noErr, let nameRef else {
        return scope.unknownName
    }

    return nameRef.takeUnretainedValue() as String
}

/// Maps CoreAudio transport constants into normalized string values.
func deviceTransportType(_ deviceId: AudioObjectID) -> String? {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyTransportType,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )

    var transportType: UInt32 = 0
    var propertySize = UInt32(MemoryLayout<UInt32>.size)

    let status = AudioObjectGetPropertyData(deviceId, &address, 0, nil, &propertySize, &transportType)
    guard status == noErr else {
        return nil
    }

    switch transportType {
    case 1634430838: return "built-in"
    case 1970496032: return "usb"
    case 1651663479: return "bluetooth"
    case 1885762592: return "pci"
    case 1718449215: return "firewire"
    case 1986226285: return "thunderbolt"
    case 1635087471: return "airplay"
    case 1986098294: return "virtual"
    case 1634494063: return "aggregate"
    default: return "unknown"
    }
}

/// Returns whether CoreAudio marks the device as alive/active.
func deviceIsAlive(_ deviceId: AudioObjectID) -> Bool {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyDeviceIsAlive,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )

    var isAlive: UInt32 = 1
    var propertySize = UInt32(MemoryLayout<UInt32>.size)
    let status = AudioObjectGetPropertyData(deviceId, &address, 0, nil, &propertySize, &isAlive)

    guard status == noErr else {
        return true
    }

    return isAlive != 0
}

/// Returns mute state when available for the selected stream scope.
func deviceIsMuted(_ deviceId: AudioObjectID, scope: AudioScope) -> Bool? {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyMute,
        mScope: scope.streamScope,
        mElement: kAudioObjectPropertyElementMain
    )

    var isMuted: UInt32 = 0
    var propertySize = UInt32(MemoryLayout<UInt32>.size)
    let status = AudioObjectGetPropertyData(deviceId, &address, 0, nil, &propertySize, &isMuted)

    guard status == noErr else {
        return nil
    }

    return isMuted != 0
}

/// Maps device datasource constants to simplified form-factor labels.
func deviceFormFactor(_ deviceId: AudioObjectID, scope: AudioScope) -> String? {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyDataSource,
        mScope: scope.streamScope,
        mElement: kAudioObjectPropertyElementMain
    )

    var dataSource: UInt32 = 0
    var propertySize = UInt32(MemoryLayout<UInt32>.size)

    let status = AudioObjectGetPropertyData(deviceId, &address, 0, nil, &propertySize, &dataSource)

    guard status == noErr else {
        return "unknown"
    }

    switch dataSource {
    case 1751412846:
        return "headphones"
    case 1769173605, 1769173099:
        return "speakers"
    case 1936745572:
        return "line-out"
    default:
        return "unknown"
    }
}

/// Gets the current default device id for the requested scope.
func defaultDeviceId(scope: AudioScope) -> AudioObjectID? {
    var address = AudioObjectPropertyAddress(
        mSelector: scope.defaultDeviceSelector,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )

    var deviceId = AudioObjectID(0)
    var propertySize = UInt32(MemoryLayout<AudioObjectID>.size)
    let status = AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &propertySize, &deviceId)

    guard status == noErr, deviceId != 0 else {
        return nil
    }

    return deviceId
}

/// Sets default input/output device through system object properties.
func setDefaultDevice(scope: AudioScope, _ deviceId: AudioObjectID) throws {
    var address = AudioObjectPropertyAddress(
        mSelector: scope.defaultDeviceSelector,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )

    var mutableDeviceId = deviceId
    let propertySize = UInt32(MemoryLayout<AudioObjectID>.size)

    try check(
        AudioObjectSetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, propertySize, &mutableDeviceId),
        "AudioObjectSetPropertyData(defaultDeviceSelector)"
    )
}

/// Reads and normalizes full device state for query/set responses.
func queryState(scope: AudioScope) throws -> AudioState {
    let devices = try allDeviceIds()
        .filter { isDevice($0, scope: scope) }
        .map { deviceId -> AudioDevice in
            AudioDevice(
                id: String(deviceId),
                name: deviceName(deviceId, scope: scope),
                formFactor: deviceFormFactor(deviceId, scope: scope),
                transportType: deviceTransportType(deviceId),
                isDisabled: !deviceIsAlive(deviceId),
                isMuted: deviceIsMuted(deviceId, scope: scope)
            )
        }
        .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }

    let defaultId = defaultDeviceId(scope: scope).map(String.init)
    return AudioState(devices: devices, defaultId: defaultId)
}

/// Emits JSON payload to stdout for the Node.js bridge parser.
func emitJson(_ state: AudioState) throws {
    let encoder = JSONEncoder()
    let data = try encoder.encode(state)
    guard let json = String(data: data, encoding: .utf8) else {
        throw BridgeError.osStatus("JSON encoding", -1)
    }

    print(json)
}

/// Emits change notifications whenever default/mute state changes.
///
/// Contract:
/// - Writes `ready` once listeners are attached.
/// - Writes `changed` on each relevant system event.
/// - Blocks indefinitely via `dispatchMain()`.
func watch(scope: AudioScope) throws {
    var defaultDeviceAddress = AudioObjectPropertyAddress(
        mSelector: scope.defaultDeviceSelector,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )

    var currentDefaultDeviceId: AudioObjectID? = defaultDeviceId(scope: scope)
    var muteListenerAdded = false

    let queue = DispatchQueue(label: scope.watchQueueLabel)

    func emitChange() {
        print("changed")
        fflush(stdout)
    }

    func addMuteListener(deviceId: AudioObjectID) {
        var muteAddress = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyMute,
            mScope: scope.streamScope,
            mElement: kAudioObjectPropertyElementMain
        )

        let muteStatus = AudioObjectAddPropertyListenerBlock(
            deviceId,
            &muteAddress,
            queue
        ) { _, _ in
            emitChange()
        }

        if muteStatus == noErr {
            muteListenerAdded = true
        }
    }

    func removeMuteListener(deviceId: AudioObjectID) {
        guard muteListenerAdded else { return }

        var muteAddress = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyMute,
            mScope: scope.streamScope,
            mElement: kAudioObjectPropertyElementMain
        )

        AudioObjectRemovePropertyListenerBlock(
            deviceId,
            &muteAddress,
            queue
        ) { _, _ in
            emitChange()
        }

        muteListenerAdded = false
    }

    if let deviceId = currentDefaultDeviceId {
        addMuteListener(deviceId: deviceId)
    }

    let defaultDeviceStatus = AudioObjectAddPropertyListenerBlock(
        AudioObjectID(kAudioObjectSystemObject),
        &defaultDeviceAddress,
        queue
    ) { _, _ in
        let newDefaultDeviceId = defaultDeviceId(scope: scope)

        if let oldDeviceId = currentDefaultDeviceId {
            removeMuteListener(deviceId: oldDeviceId)
        }

        if let newDeviceId = newDefaultDeviceId {
            addMuteListener(deviceId: newDeviceId)
        }

        currentDefaultDeviceId = newDefaultDeviceId
        emitChange()
    }

    guard defaultDeviceStatus == noErr else {
        throw BridgeError.osStatus("AudioObjectAddPropertyListenerBlock(defaultDeviceSelector)", defaultDeviceStatus)
    }

    print("ready")
    fflush(stdout)
    dispatchMain()
}

/// Entry point contract:
/// - self-test <scope>
/// - query <scope>
/// - set <scope> <deviceId>
/// - watch <scope>
do {
    let action = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "query"
    let scopeRaw = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "output"
    let scope = AudioScope(scopeRaw)

    switch action {
    case "self-test":
        try emitJson(
            AudioState(
                devices: [
                    AudioDevice(
                        id: "self-test",
                        name: "Audio Bridge Self Test",
                        formFactor: "speakers",
                        transportType: "virtual",
                        isDisabled: false,
                        isMuted: false
                    )
                ],
                defaultId: "self-test"
            )
        )
    case "query":
        try emitJson(try queryState(scope: scope))
    case "set":
        guard CommandLine.arguments.count > 3,
              let rawDeviceId = UInt32(CommandLine.arguments[3]) else {
            throw BridgeError.invalidDeviceId
        }

        try setDefaultDevice(scope: scope, rawDeviceId)
        try emitJson(try queryState(scope: scope))
    case "watch":
        try watch(scope: scope)
    default:
        throw BridgeError.unknownAction
    }
} catch BridgeError.invalidDeviceId {
    fputs("Invalid macOS audio device id.\n", stderr)
    exit(1)
} catch BridgeError.unknownAction {
    fputs("Unknown CoreAudio bridge action.\n", stderr)
    exit(1)
} catch BridgeError.osStatus(let operation, let status) {
    fputs("\(operation) failed with OSStatus \(status).\n", stderr)
    exit(1)
} catch {
    fputs("CoreAudio bridge failed with an unexpected error.\n", stderr)
    exit(1)
}
