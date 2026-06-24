import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CourierConnectionStatus,
  CourierProviderType,
  TrackingLanguage,
  TrackingResponseStyle,
  TrackingSyncInterval,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { decryptJson, encryptJson } from "../../common/utils/crypto.util";
import { COURIER_PROVIDER_META, getCourierProvider } from "./courier-provider.factory";
import {
  CreateCourierConnectionDto,
  UpdateCourierConnectionDto,
  UpdateShippingDeliverySettingsDto,
} from "./dto/courier.dto";

@Injectable()
export class CourierService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  listProviders() {
    return Object.entries(COURIER_PROVIDER_META).map(([type, meta]) => ({
      provider: type as CourierProviderType,
      ...meta,
    }));
  }

  async listConnections(organizationId: string) {
    const connections = await this.prisma.courierConnection.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });

    return connections.map((conn) => this.sanitizeConnection(conn));
  }

  async getConnection(organizationId: string, id: string) {
    const conn = await this.prisma.courierConnection.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!conn) throw new NotFoundException("Courier connection not found");
    return this.sanitizeConnection(conn);
  }

  async createConnection(organizationId: string, dto: CreateCourierConnectionDto) {
    const provider = getCourierProvider(dto.provider);
    const validation = provider.validateCredentials(dto.credentials);
    if (!validation.success) {
      throw new BadRequestException(validation.message);
    }

    const existing = await this.prisma.courierConnection.findFirst({
      where: { organizationId, provider: dto.provider, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException(`${dto.provider} is already connected. Update or disconnect first.`);
    }

    const test = await provider.testConnection(dto.credentials);
    const credentialsEnc = encryptJson(
      dto.credentials,
      this.config.get<string>("ENCRYPTION_KEY"),
    );

    const conn = await this.prisma.courierConnection.create({
      data: {
        organizationId,
        provider: dto.provider,
        accountName: dto.accountName ?? test.accountName,
        credentialsEnc,
        status: test.success ? CourierConnectionStatus.CONNECTED : CourierConnectionStatus.ERROR,
        lastError: test.success ? null : test.message,
      },
    });

    return this.sanitizeConnection(conn);
  }

  async updateConnection(organizationId: string, id: string, dto: UpdateCourierConnectionDto) {
    const conn = await this.prisma.courierConnection.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!conn) throw new NotFoundException("Courier connection not found");

    let credentialsEnc = conn.credentialsEnc;
    let status = conn.status;
    let lastError = conn.lastError;
    let accountName = dto.accountName ?? conn.accountName;

    if (dto.credentials) {
      const provider = getCourierProvider(conn.provider);
      const validation = provider.validateCredentials(dto.credentials);
      if (!validation.success) throw new BadRequestException(validation.message);

      const test = await provider.testConnection(dto.credentials);
      credentialsEnc = encryptJson(dto.credentials, this.config.get<string>("ENCRYPTION_KEY"));
      status = test.success ? CourierConnectionStatus.CONNECTED : CourierConnectionStatus.ERROR;
      lastError = test.success ? null : test.message;
      accountName = dto.accountName ?? test.accountName ?? accountName;
    }

    const updated = await this.prisma.courierConnection.update({
      where: { id },
      data: { accountName, credentialsEnc, status, lastError },
    });

    return this.sanitizeConnection(updated);
  }

  async testConnection(organizationId: string, id: string) {
    const conn = await this.prisma.courierConnection.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!conn) throw new NotFoundException("Courier connection not found");

    const credentials = this.decryptCredentials(conn.credentialsEnc);
    const provider = getCourierProvider(conn.provider);
    const result = await provider.testConnection(credentials);

    await this.prisma.courierConnection.update({
      where: { id },
      data: {
        status: result.success ? CourierConnectionStatus.CONNECTED : CourierConnectionStatus.ERROR,
        lastError: result.success ? null : result.message,
        accountName: result.accountName ?? conn.accountName,
      },
    });

    return result;
  }

  async disconnect(organizationId: string, id: string) {
    const conn = await this.prisma.courierConnection.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!conn) throw new NotFoundException("Courier connection not found");

    await this.prisma.courierConnection.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: CourierConnectionStatus.DISCONNECTED,
      },
    });

    return { success: true };
  }

  async reconnect(organizationId: string, id: string) {
    return this.testConnection(organizationId, id);
  }

  decryptCredentials(credentialsEnc: string) {
    return decryptJson(credentialsEnc, this.config.get<string>("ENCRYPTION_KEY"));
  }

  async getSettings(organizationId: string) {
    const settings = await this.prisma.shippingDeliverySettings.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
    });

    const connections = await this.listConnections(organizationId);
    const providers = this.listProviders();

    return { settings, connections, providers };
  }

  async updateSettings(organizationId: string, dto: UpdateShippingDeliverySettingsDto) {
    const settings = await this.prisma.shippingDeliverySettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        responseStyle: dto.responseStyle ?? TrackingResponseStyle.DETAILED,
        language: dto.language ?? TrackingLanguage.AUTO,
        syncInterval: dto.syncInterval ?? TrackingSyncInterval.THIRTY_MINUTES,
        portalEnabled: dto.portalEnabled ?? true,
      },
      update: dto,
    });

    return settings;
  }

  async getConnectedProviders(organizationId: string) {
    return this.prisma.courierConnection.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: CourierConnectionStatus.CONNECTED,
      },
    });
  }

  private sanitizeConnection(conn: {
    id: string;
    organizationId: string;
    provider: CourierProviderType;
    accountName: string | null;
    credentialsEnc: string;
    status: CourierConnectionStatus;
    lastSyncAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const { credentialsEnc: _credentialsEnc, ...rest } = conn;
    return {
      ...rest,
      label: COURIER_PROVIDER_META[conn.provider]?.label ?? conn.provider,
      hasCredentials: !!conn.credentialsEnc,
    };
  }
}
