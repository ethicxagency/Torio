import { BadRequestException } from "@nestjs/common";
import { CourierProviderType } from "@prisma/client";
import { CourierProviderInterface } from "./providers/courier-provider.interface";
import { SteadfastProvider } from "./providers/steadfast.provider";
import { RedxProvider } from "./providers/redx.provider";
import { PaperflyProvider } from "./providers/paperfly.provider";
import { PathaoProvider } from "./providers/pathao.provider";

const providers: Record<CourierProviderType, CourierProviderInterface> = {
  [CourierProviderType.STEADFAST]: new SteadfastProvider(),
  [CourierProviderType.REDX]: new RedxProvider(),
  [CourierProviderType.PAPERFLY]: new PaperflyProvider(),
  [CourierProviderType.PATHAO]: new PathaoProvider(),
};

export function getCourierProvider(type: CourierProviderType): CourierProviderInterface {
  const provider = providers[type];
  if (!provider) throw new BadRequestException(`Unsupported courier provider: ${type}`);
  return provider;
}

export const COURIER_PROVIDER_META: Record<
  CourierProviderType,
  { label: string; credentialFields: { key: string; label: string; type?: string }[] }
> = {
  STEADFAST: {
    label: "SteadFast",
    credentialFields: [
      { key: "apiKey", label: "API Key" },
      { key: "secretKey", label: "Secret Key", type: "password" },
    ],
  },
  REDX: {
    label: "RedX",
    credentialFields: [{ key: "apiToken", label: "API Token", type: "password" }],
  },
  PAPERFLY: {
    label: "Paperfly",
    credentialFields: [
      { key: "username", label: "Username" },
      { key: "password", label: "Password", type: "password" },
    ],
  },
  PATHAO: {
    label: "Pathao Courier",
    credentialFields: [
      { key: "clientId", label: "Client ID" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
  },
};
