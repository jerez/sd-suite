using System;
using System.Collections.Generic;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;

/// <summary>
/// WASAPI audio flow selector.
/// </summary>
public enum EDataFlow {
    eRender = 0,
    eCapture = 1
}

/// <summary>
/// Default endpoint role selector.
/// </summary>
public enum ERole {
    eConsole = 0,
    eMultimedia = 1,
    eCommunications = 2
}

/// <summary>
/// IMMDevice state flags.
/// </summary>
[Flags]
public enum DEVICE_STATE : uint {
    ACTIVE = 0x00000001,
    DISABLED = 0x00000002,
    NOTPRESENT = 0x00000004,
    UNPLUGGED = 0x00000008,
    ALL = ACTIVE | DISABLED | NOTPRESENT | UNPLUGGED
}

/// <summary>
/// COM property key (format id + property id).
/// </summary>
[StructLayout(LayoutKind.Sequential)]
public struct PROPERTYKEY {
    public Guid fmtid;
    public uint pid;
}

/// <summary>
/// COM PROPVARIANT shim used for property-store reads.
/// </summary>
[StructLayout(LayoutKind.Explicit)]
public struct PROPVARIANT {
    [FieldOffset(0)]
    public ushort vt;

    [FieldOffset(8)]
    public IntPtr pointerValue;

    public string GetValue() {
        if (pointerValue == IntPtr.Zero) {
            return string.Empty;
        }

        return Marshal.PtrToStringUni(pointerValue) ?? string.Empty;
    }
}

[ComImport]
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
    [PreserveSig]
    int EnumAudioEndpoints(EDataFlow dataFlow, DEVICE_STATE stateMask, out IMMDeviceCollection devices);
    [PreserveSig]
    int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice endpoint);
    [PreserveSig]
    int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string deviceId, out IMMDevice device);
    [PreserveSig]
    int RegisterEndpointNotificationCallback(IMMNotificationClient client);
    [PreserveSig]
    int UnregisterEndpointNotificationCallback(IMMNotificationClient client);
}

[ComImport]
[Guid("D666063F-1587-4E43-81F1-B948E807363F")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
    [PreserveSig]
    int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, out IntPtr interfacePointer);
    [PreserveSig]
    int OpenPropertyStore(int stgmAccess, out IPropertyStore properties);
    [PreserveSig]
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    [PreserveSig]
    int GetState(out DEVICE_STATE state);
}

[ComImport]
[Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceCollection {
    [PreserveSig]
    int GetCount(out uint count);
    [PreserveSig]
    int Item(uint item, out IMMDevice device);
}

[ComImport]
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolume {
    [PreserveSig]
    int RegisterControlChangeNotify(IntPtr notify);
    [PreserveSig]
    int UnregisterControlChangeNotify(IntPtr notify);
    [PreserveSig]
    int GetChannelCount(out uint channelCount);
    [PreserveSig]
    int SetMasterVolumeLevel(float levelDB, Guid eventContext);
    [PreserveSig]
    int SetMasterVolumeLevelScalar(float level, Guid eventContext);
    [PreserveSig]
    int GetMasterVolumeLevel(out float levelDB);
    [PreserveSig]
    int GetMasterVolumeLevelScalar(out float level);
    [PreserveSig]
    int SetChannelVolumeLevel(uint channelNumber, float levelDB, Guid eventContext);
    [PreserveSig]
    int SetChannelVolumeLevelScalar(uint channelNumber, float level, Guid eventContext);
    [PreserveSig]
    int GetChannelVolumeLevel(uint channelNumber, out float levelDB);
    [PreserveSig]
    int GetChannelVolumeLevelScalar(uint channelNumber, out float level);
    [PreserveSig]
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool isMuted, Guid eventContext);
    [PreserveSig]
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool isMuted);
    [PreserveSig]
    int GetVolumeStepInfo(out uint step, out uint stepCount);
    [PreserveSig]
    int VolumeStepUp(Guid eventContext);
    [PreserveSig]
    int VolumeStepDown(Guid eventContext);
    [PreserveSig]
    int QueryHardwareSupport(out uint hardwareSupportMask);
    [PreserveSig]
    int GetVolumeRange(out float volumeMindB, out float volumeMaxdB, out float volumeIncrementdB);
}

[ComImport]
[Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPropertyStore {
    [PreserveSig]
    int GetCount(out uint propertyCount);
    [PreserveSig]
    int GetAt(uint propertyIndex, out PROPERTYKEY key);
    [PreserveSig]
    int GetValue(ref PROPERTYKEY key, out PROPVARIANT value);
    [PreserveSig]
    int SetValue(ref PROPERTYKEY key, ref PROPVARIANT value);
    [PreserveSig]
    int Commit();
}

[ComImport]
[Guid("7991EEC9-7E89-4D85-8390-6C703CEC60C0")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMNotificationClient {
    [PreserveSig]
    int OnDeviceStateChanged([MarshalAs(UnmanagedType.LPWStr)] string deviceId, DEVICE_STATE newState);
    [PreserveSig]
    int OnDeviceAdded([MarshalAs(UnmanagedType.LPWStr)] string deviceId);
    [PreserveSig]
    int OnDeviceRemoved([MarshalAs(UnmanagedType.LPWStr)] string deviceId);
    [PreserveSig]
    int OnDefaultDeviceChanged(EDataFlow flow, ERole role, [MarshalAs(UnmanagedType.LPWStr)] string defaultDeviceId);
    [PreserveSig]
    int OnPropertyValueChanged([MarshalAs(UnmanagedType.LPWStr)] string deviceId, PROPERTYKEY key);
}

[ComImport]
[Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorComObject {
}

[ComImport]
[Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")]
public class CPolicyConfigClient {
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
[Guid("F8679F50-850A-41CF-9C72-430F290290C8")]
public interface IPolicyConfig {
    [PreserveSig]
    int NotImpl1();
    [PreserveSig]
    int NotImpl2();
    [PreserveSig]
    int NotImpl3();
    [PreserveSig]
    int NotImpl4();
    [PreserveSig]
    int NotImpl5();
    [PreserveSig]
    int NotImpl6();
    [PreserveSig]
    int NotImpl7();
    [PreserveSig]
    int NotImpl8();
    [PreserveSig]
    int NotImpl9();
    [PreserveSig]
    int NotImpl10();
    [PreserveSig]
    int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string deviceId, ERole role);
}

/// <summary>
/// Serialized device payload returned to the Node.js layer.
/// </summary>
public class AudioDeviceInfo {
    public string id;
    public string name;
    public string formFactor;
    public string transportType;
    public bool isDisabled;
    public bool? isMuted;
}

/// <summary>
/// Serialized query response containing devices and default id.
/// </summary>
public class AudioQueryResult {
    public AudioDeviceInfo[] devices;
    public string defaultId;
}

/// <summary>
/// Notification client that forwards endpoint changes as generic events.
/// </summary>
public sealed class DefaultDeviceNotificationClient : IMMNotificationClient {
    private readonly Action<EDataFlow, ERole, string> onDefaultDeviceChanged;
    private readonly Action onAnyDevicePropertyChanged;

    public DefaultDeviceNotificationClient(Action<EDataFlow, ERole, string> onDefaultDeviceChanged, Action onAnyDevicePropertyChanged) {
        this.onDefaultDeviceChanged = onDefaultDeviceChanged;
        this.onAnyDevicePropertyChanged = onAnyDevicePropertyChanged;
    }

    public int OnDeviceStateChanged(string deviceId, DEVICE_STATE newState) {
        onAnyDevicePropertyChanged();
        return 0;
    }

    public int OnDeviceAdded(string deviceId) {
        onAnyDevicePropertyChanged();
        return 0;
    }

    public int OnDeviceRemoved(string deviceId) {
        onAnyDevicePropertyChanged();
        return 0;
    }

    public int OnDefaultDeviceChanged(EDataFlow flow, ERole role, string defaultDeviceId) {
        onDefaultDeviceChanged(flow, role, defaultDeviceId);
        return 0;
    }

    public int OnPropertyValueChanged(string deviceId, PROPERTYKEY key) {
        onAnyDevicePropertyChanged();
        return 0;
    }
}

/// <summary>
/// Verifies the managed COM declarations used by the bridge before native calls.
/// </summary>
public static class InteropContractValidator {
    private static readonly Type[] HResultInterfaces = {
        typeof(IMMDeviceEnumerator),
        typeof(IMMDevice),
        typeof(IMMDeviceCollection),
        typeof(IAudioEndpointVolume),
        typeof(IPropertyStore),
        typeof(IMMNotificationClient),
        typeof(IPolicyConfig)
    };

    public static void Validate() {
        ValidateMethodOrder(
            typeof(IMMDeviceEnumerator),
            "EnumAudioEndpoints",
            "GetDefaultAudioEndpoint",
            "GetDevice",
            "RegisterEndpointNotificationCallback",
            "UnregisterEndpointNotificationCallback"
        );

        MethodInfo[] policyMethods = GetMethodsInMetadataOrder(typeof(IPolicyConfig));
        if (policyMethods.Length <= 10 || policyMethods[10].Name != "SetDefaultEndpoint") {
            throw new InvalidOperationException("IPolicyConfig.SetDefaultEndpoint must occupy vtable slot 10.");
        }

        foreach (Type interfaceType in HResultInterfaces) {
            foreach (MethodInfo method in interfaceType.GetMethods()) {
                MethodImplAttributes flags = method.GetMethodImplementationFlags();
                if ((flags & MethodImplAttributes.PreserveSig) == 0) {
                    throw new InvalidOperationException(
                        interfaceType.Name + "." + method.Name + " must preserve its HRESULT signature."
                    );
                }
            }
        }
    }

    private static void ValidateMethodOrder(Type interfaceType, params string[] expectedNames) {
        MethodInfo[] methods = GetMethodsInMetadataOrder(interfaceType);
        if (methods.Length != expectedNames.Length) {
            throw new InvalidOperationException(interfaceType.Name + " has an unexpected method count.");
        }

        for (int index = 0; index < expectedNames.Length; index++) {
            if (methods[index].Name != expectedNames[index]) {
                throw new InvalidOperationException(interfaceType.Name + " has an invalid COM vtable order.");
            }
        }
    }

    private static MethodInfo[] GetMethodsInMetadataOrder(Type interfaceType) {
        MethodInfo[] methods = interfaceType.GetMethods();
        Array.Sort(methods, (left, right) => left.MetadataToken.CompareTo(right.MetadataToken));
        return methods;
    }
}

/// <summary>
/// Core Windows bridge implementation used by the PowerShell launcher.
/// </summary>
public static class AudioEndpointBridge {
    private const int STGM_READ = 0;
    private const int CLSCTX_ALL = 23;
    private static readonly PROPERTYKEY PKEY_Device_FriendlyName = new PROPERTYKEY {
        fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),
        pid = 14
    };

    private static Guid IID_IAudioEndpointVolume = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");

    private static readonly PROPERTYKEY PKEY_AudioEndpoint_FormFactor = new PROPERTYKEY {
        fmtid = new Guid("1da5d803-d492-4edd-8c23-e0c0ffee7f0e"),
        pid = 0
    };

    private static readonly PROPERTYKEY PKEY_Device_DeviceDesc = new PROPERTYKEY {
        fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),
        pid = 2
    };

    [DllImport("Ole32.dll")]
    private static extern int PropVariantClear(ref PROPVARIANT value);

    /// <summary>
    /// Throws an exception when a COM HRESULT indicates failure.
    /// </summary>
    private static void Check(int hr, string operation) {
        if (hr < 0) {
            Marshal.ThrowExceptionForHR(hr);
        }
    }

    /// <summary>
    /// Maps endpoint form-factor constants to normalized labels.
    /// </summary>
    private static string NormalizeFormFactor(uint formFactor) {
        switch (formFactor) {
            case 1: return "speakers";
            case 2: return "headphones";
            case 3: return "line-out";
            case 4: return "digital";
            case 5: return "speakers";
            case 6: return "speakers";
            case 7: return "speakers";
            case 8: return "hdmi";
            case 9: return "spdif";
            default: return "unknown";
        }
    }

    /// <summary>
    /// Best-effort transport classification from id/descriptor hints.
    /// </summary>
    private static string DetectTransportType(string deviceId, string deviceDesc) {
        if (deviceId == null) return "unknown";

        string upper = deviceId.ToUpperInvariant();
        string descUpper = (deviceDesc ?? "").ToUpperInvariant();

        if (upper.Contains("USB") || descUpper.Contains("USB")) return "usb";
        if (upper.Contains("BTHENUM") || descUpper.Contains("BLUETOOTH")) return "bluetooth";
        if (upper.Contains("HDAUDIO") || upper.Contains("HDA")) return "built-in";
        if (upper.Contains("HDMI")) return "hdmi";
        if (upper.Contains("DISPLAY")) return "displayport";
        if (upper.Contains("VIRTUAL") || descUpper.Contains("VIRTUAL")) return "virtual";
        if (upper.Contains("WIRE")) return "wireless";

        return "unknown";
    }

    /// <summary>
    /// Enumerates endpoints for a flow and returns normalized bridge data.
    /// </summary>
    public static AudioQueryResult Query(EDataFlow flow) {
        var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();

        string defaultDeviceId = null;
        try {
            IMMDevice defaultDevice;
            Check(enumerator.GetDefaultAudioEndpoint(flow, ERole.eMultimedia, out defaultDevice), "GetDefaultAudioEndpoint");
            Check(defaultDevice.GetId(out defaultDeviceId), "IMMDevice.GetId(default)");
        }
        catch {
            defaultDeviceId = null;
        }

        IMMDeviceCollection collection;
        Check(enumerator.EnumAudioEndpoints(flow, DEVICE_STATE.ALL, out collection), "EnumAudioEndpoints");

        uint count;
        Check(collection.GetCount(out count), "IMMDeviceCollection.GetCount");

        var devices = new List<AudioDeviceInfo>((int)count);
        for (uint index = 0; index < count; index++) {
            IMMDevice device;
            Check(collection.Item(index, out device), "IMMDeviceCollection.Item");

            string deviceId;
            Check(device.GetId(out deviceId), "IMMDevice.GetId");

            DEVICE_STATE state;
            int stateHr = device.GetState(out state);
            bool isDisabled = stateHr >= 0 && (state & DEVICE_STATE.ACTIVE) != DEVICE_STATE.ACTIVE;

            IPropertyStore propertyStore;
            Check(device.OpenPropertyStore(STGM_READ, out propertyStore), "IMMDevice.OpenPropertyStore");

            devices.Add(new AudioDeviceInfo {
                id = deviceId,
                name = GetPropertyString(propertyStore, PKEY_Device_FriendlyName),
                formFactor = GetDeviceFormFactor(propertyStore),
                transportType = DetectTransportType(deviceId, GetPropertyString(propertyStore, PKEY_Device_DeviceDesc)),
                isDisabled = isDisabled,
                isMuted = GetDeviceMuted(device)
            });
        }

        return new AudioQueryResult {
            devices = devices.ToArray(),
            defaultId = defaultDeviceId
        };
    }

    /// <summary>
    /// Sets default endpoint for console/multimedia/communications roles.
    /// </summary>
    public static void SetDefault(string deviceId) {
        if (string.IsNullOrWhiteSpace(deviceId)) {
            throw new ArgumentException("Device id is required.", nameof(deviceId));
        }

        var policyConfig = (IPolicyConfig)new CPolicyConfigClient();
        Check(policyConfig.SetDefaultEndpoint(deviceId, ERole.eConsole), "SetDefaultEndpoint(eConsole)");
        Check(policyConfig.SetDefaultEndpoint(deviceId, ERole.eMultimedia), "SetDefaultEndpoint(eMultimedia)");
        Check(policyConfig.SetDefaultEndpoint(deviceId, ERole.eCommunications), "SetDefaultEndpoint(eCommunications)");
    }

    /// <summary>
    /// Registers notification callbacks and emits line-delimited events:
    /// `ready` once started, then `changed` on relevant updates.
    /// </summary>
    public static void Watch(EDataFlow watchedFlow) {
        var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
        var notificationClient = new DefaultDeviceNotificationClient(
            (flow, role, defaultDeviceId) => {
                if (flow == watchedFlow) {
                    Console.WriteLine("changed");
                    Console.Out.Flush();
                }
            },
            () => {
                Console.WriteLine("changed");
                Console.Out.Flush();
            }
        );

        Check(
            enumerator.RegisterEndpointNotificationCallback(notificationClient),
            "RegisterEndpointNotificationCallback"
        );

        Console.WriteLine("ready");
        Console.Out.Flush();

        try {
            Thread.Sleep(Timeout.Infinite);
        }
        finally {
            try {
                enumerator.UnregisterEndpointNotificationCallback(notificationClient);
            }
            catch {
            }
        }
    }

    /// <summary>
    /// Reads a UTF-16 property string from an endpoint property store.
    /// </summary>
    private static string GetPropertyString(IPropertyStore propertyStore, PROPERTYKEY key) {
        PROPVARIANT value;
        int hr = propertyStore.GetValue(ref key, out value);

        if (hr < 0) {
            return string.Empty;
        }

        try {
            return value.GetValue();
        }
        finally {
            PropVariantClear(ref value);
        }
    }

    /// <summary>
    /// Reads and normalizes endpoint form factor from property store.
    /// </summary>
    private static string GetDeviceFormFactor(IPropertyStore propertyStore) {
        PROPVARIANT value;
        PROPERTYKEY key = PKEY_AudioEndpoint_FormFactor;
        int hr = propertyStore.GetValue(ref key, out value);

        if (hr < 0) {
            return "unknown";
        }

        try {
            if (value.vt == 19) {
                uint formFactorValue = (uint)value.pointerValue.ToInt32();
                return NormalizeFormFactor(formFactorValue);
            }
            return "unknown";
        }
        finally {
            PropVariantClear(ref value);
        }
    }

    /// <summary>
    /// Reads endpoint mute state via IAudioEndpointVolume when available.
    /// </summary>
    private static bool? GetDeviceMuted(IMMDevice device) {
        IntPtr endpointVolumePtr = IntPtr.Zero;

        try {
            int activateHr = device.Activate(ref IID_IAudioEndpointVolume, CLSCTX_ALL, IntPtr.Zero, out endpointVolumePtr);
            if (activateHr < 0 || endpointVolumePtr == IntPtr.Zero) {
                return null;
            }

            var endpointVolume = (IAudioEndpointVolume)Marshal.GetObjectForIUnknown(endpointVolumePtr);
            bool isMuted;
            int muteHr = endpointVolume.GetMute(out isMuted);
            if (muteHr < 0) {
                return null;
            }

            return isMuted;
        }
        catch {
            return null;
        }
        finally {
            if (endpointVolumePtr != IntPtr.Zero) {
                Marshal.Release(endpointVolumePtr);
            }
        }
    }
}

public static class Program {
    [STAThread]
    public static int Main(string[] args) {
        try {
            string action = args.Length > 0 ? args[0] : "query";
            EDataFlow flow = args.Length > 1 && args[1] == "input"
                ? EDataFlow.eCapture
                : EDataFlow.eRender;

            if (action == "watch") {
                AudioEndpointBridge.Watch(flow);
                return 0;
            }

            AudioQueryResult result;
            if (action == "self-test") {
                InteropContractValidator.Validate();
                result = new AudioQueryResult {
                    devices = new[] {
                        new AudioDeviceInfo {
                            id = "self-test",
                            name = "Audio Bridge Self Test",
                            formFactor = "speakers",
                            transportType = "virtual",
                            isDisabled = false,
                            isMuted = false
                        }
                    },
                    defaultId = "self-test"
                };
            }
            else {
                if (action == "set") {
                    if (args.Length < 3 || string.IsNullOrWhiteSpace(args[2])) {
                        throw new ArgumentException("Device id is required for set action.");
                    }
                    AudioEndpointBridge.SetDefault(args[2]);
                }
                else if (action != "query") {
                    throw new ArgumentException("Unknown Windows audio bridge action.");
                }

                result = AudioEndpointBridge.Query(flow);
            }

            Console.WriteLine(new JavaScriptSerializer().Serialize(result));
            return 0;
        }
        catch (Exception error) {
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }
}
