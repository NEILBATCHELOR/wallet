// src/services/ledger/LedgerService.ts
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import { Observable, Subject } from "rxjs";

/**
 * Transport type for Ledger connection
 */
export type TransportType = "webusb" | "webhid";

/**
 * Ledger device information
 */
export interface LedgerDeviceInfo {
  id: string;
  name: string;
  model: string;
  firmwareVersion?: string;
}

/**
 * Base Ledger service providing common functionality
 * for connecting to Ledger devices
 */
export class LedgerService {
  private static instance: LedgerService;
  private transport: any = null;
  private transportType: TransportType = "webusb";
  private deviceInfo: LedgerDeviceInfo | null = null;
  private deviceConnected = new Subject<boolean>();

  protected constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): LedgerService {
    if (!LedgerService.instance) {
      LedgerService.instance = new LedgerService();
    }
    return LedgerService.instance;
  }

  /**
   * Get the current transport
   */
  public getTransport(): any {
    return this.transport;
  }

  /**
   * Get device connection status as observable
   */
  public getDeviceStatus(): Observable<boolean> {
    return this.deviceConnected.asObservable();
  }

  /**
   * Set the transport type
   */
  public setTransportType(type: TransportType): void {
    this.transportType = type;
  }

  /**
   * Check if the browser supports Ledger connections
   */
  public isBrowserSupported(): boolean {
    return !!navigator.usb || !!navigator.hid;
  }

  /**
   * Connect to a Ledger device
   */
  public async connect(): Promise<boolean> {
    try {
      if (this.transport) {
        await this.disconnect();
      }

      // Create transport based on type
      if (this.transportType === "webusb") {
        this.transport = await TransportWebUSB.create();
      } else if (this.transportType === "webhid") {
        this.transport = await TransportWebHID.create();
      } else {
        throw new Error(`Unsupported transport type: ${this.transportType}`);
      }

      // Set up event handlers
      this.transport.on("disconnect", () => {
        this.deviceInfo = null;
        this.deviceConnected.next(false);
      });

      // Get device info
      await this.getDeviceInfo();

      this.deviceConnected.next(true);
      return true;
    } catch (error) {
      console.error("Failed to connect to Ledger device:", error);
      this.deviceConnected.next(false);
      return false;
    }
  }

  /**
   * Disconnect from the Ledger device
   */
  public async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
      this.deviceInfo = null;
      this.deviceConnected.next(false);
    }
  }

  /**
   * Get information about the connected device
   */
  public async getDeviceInfo(): Promise<LedgerDeviceInfo | null> {
    if (!this.transport) {
      return null;
    }

    try {
      // Request device info using the device info app
      const deviceInfo = {
        id: "unknown",
        name: "Ledger Device",
        model: "unknown"
      };

      // For now, just return a placeholder
      // In a real implementation, you'd query for the model type
      this.deviceInfo = deviceInfo;
      return deviceInfo;
    } catch (error) {
      console.error("Failed to get device info:", error);
      return null;
    }
  }

  /**
   * Check if a device is connected
   */
  public isConnected(): boolean {
    return !!this.transport;
  }

  /**
   * Choose the best available transport type
   */
  public async detectBestTransport(): Promise<TransportType | null> {
    // Try WebUSB first
    if (navigator.usb) {
      try {
        await TransportWebUSB.isSupported();
        this.transportType = "webusb";
        return "webusb";
      } catch (e) {
        console.log("WebUSB not supported");
      }
    }

    // Try WebHID
    if (navigator.hid) {
      try {
        await TransportWebHID.isSupported();
        this.transportType = "webhid";
        return "webhid";
      } catch (e) {
        console.log("WebHID not supported");
      }
    }

    return null;
  }
}