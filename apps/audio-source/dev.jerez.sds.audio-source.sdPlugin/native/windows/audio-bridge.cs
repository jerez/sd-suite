using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;

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
    int NotImpl1();
    int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice endpoint);
    int NotImpl2();
    int NotImpl3();
    int NotImpl4();
    int EnumAudioEndpoints(EDataFlow dataFlow, DEVICE_STATE stateMask, out IMMDeviceCollection devices);
}

[ComImport]
[Guid("D666063F-1587-4E43-81F1-B948E807363F")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
    int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, out IntPtr interfacePointer);
    int OpenPropertyStore(int stgmAccess, out IPropertyStore properties);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    int GetState(out DEVICE_STATE state);
}

[ComImport]
[Guid("0BD7A1BE-7A1A-44DB-8397-C0A1461CDBA0")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceCollection {
    int GetCount(out uint count);
    int Item(uint item, out IMMDevice device);
}

[ComImport]
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr notify);
    int UnregisterControlChangeNotify(IntPtr notify);
    int GetChannelCount(out uint channelCount);
    int SetMasterVolumeLevel(float levelDB, Guid eventContext);
    int SetMasterVolumeLevelScalar(float level, Guid eventContext);
    int GetMasterVolumeLevel(out float levelDB);
    int GetMasterVolumeLevelScalar(out float level);
    int SetChannelVolumeLevel(uint channelNumber, float levelDB, Guid eventContext);
    int SetChannelVolumeLevelScalar(uint channelNumber, float level, Guid eventContext);
    int GetChannelVolumeLevel(uint channelNumber, out float levelDB);
    int GetChannelVolumeLevelScalar(uint channelNumber, out float level);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool isMuted, Guid eventContext);
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool isMuted);
    int GetVolumeStepInfo(out uint step, out uint stepCount);
    int VolumeStepUp(Guid eventContext);
    int VolumeStepDown(Guid eventContext);
    int QueryHardwareSupport(out uint hardwareSupportMask);
    int GetVolumeRange(out float volumeMindB, out float volumeMaxdB, out float volumeIncrementdB);
}

[ComImport]
[Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPropertyStore {
    int GetCount(out uint propertyCount);
    int GetAt(uint propertyIndex, out PROPERTYKEY key);
    int GetValue(ref PROPERTYKEY key, out PROPVARIANT value);
    int SetValue(ref PROPERTYKEY key, ref PROPVARIANT value);
    int Commit();
}

[ComImport]
[Guid("7991EEC9-7E89-4D85-8390-6C703CEC60C0")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMNotificationClient {
    int OnDeviceStateChanged([MarshalAs(UnmanagedType.LPWStr)] string deviceId, DEVICE_STATE newState);
    int OnDeviceAdded([MarshalAs(UnmanagedType.LPWStr)] string deviceId);
    int OnDeviceRemoved([MarshalAs(UnmanagedType.LPWStr)] string deviceId);
    int OnDefaultDeviceChanged(EDataFlow flow, ERole role, [MarshalAs(UnmanagedType.LPWStr)] string defaultDeviceId);
    int OnPropertyValueChanged([MarshalAs(UnmanagedType.LPWStr)] string deviceId, PROPERTYKEY key);
}

[ComImport]
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumeratorNotification {
    int EnumAudioEndpoints(EDataFlow dataFlow, DEVICE_STATE stateMask, out IMMDeviceCollection devices);
    int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice endpoint);
    int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string deviceId, out IMMDevice device);
    int RegisterEndpointNotificationCallback(IMMNotificationClient client);
    int UnregisterEndpointNotificationCallback(IMMNotificationClient client);
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
    int NotImpl1();
    int NotImpl2();
    int NotImpl3();
    int NotImpl4();
    int NotImpl5();
    int NotImpl6();
    int NotImpl7();
    int NotImpl8();
    int NotImpl9();
    int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string deviceId, ERole role);
    int NotImpl10();
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
        var enumerator = (IMMDeviceEnumeratorNotification)new MMDeviceEnumeratorComObject();
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
        int hr = propertyStore.GetValue(ref PKEY_AudioEndpoint_FormFactor, out value);

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
