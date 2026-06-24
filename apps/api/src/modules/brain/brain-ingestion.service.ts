import { Injectable, BadRequestException } from "@nestjs/common";
import { BrainDocumentType } from "@prisma/client";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainService } from "./brain.service";
import { ImportWebsiteDto } from "./dto/brain.dto";

interface UploadedBrainFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class BrainIngestionService {
  private readonly storageRoot = path.join(process.cwd(), "storage", "brain");

  constructor(
    private prisma: PrismaService,
    private brainService: BrainService,
  ) {}

  async uploadDocument(
    organizationId: string,
    file: UploadedBrainFile,
  ) {
    await this.brainService.ensureInitialized(organizationId);

    const documentType = this.resolveDocumentType(file.mimetype, file.originalname);
    if (!documentType) {
      throw new BadRequestException("Unsupported file type. Use PDF, DOCX, or TXT.");
    }

    const orgDir = path.join(this.storageRoot, organizationId);
    await fs.mkdir(orgDir, { recursive: true });

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `${Date.now()}-${safeName}`;
    const filePath = path.join(orgDir, storedName);
    await fs.writeFile(filePath, file.buffer);

    const doc = await this.prisma.brainDocument.create({
      data: {
        organizationId,
        title: file.originalname.replace(/\.[^.]+$/, ""),
        filename: storedName,
        mimeType: file.mimetype,
        fileUrl: `/storage/brain/${organizationId}/${storedName}`,
        documentType,
        status: "PROCESSING",
        fileSize: file.size,
      },
    });

    try {
      const content = await this.extractText(file.buffer, documentType, file.originalname);
      return await this.prisma.brainDocument.update({
        where: { id: doc.id },
        data: {
          content,
          status: content ? "READY" : "FAILED",
          metadata: { extractedAt: new Date().toISOString(), charCount: content.length },
        },
      });
    } catch (error) {
      return await this.prisma.brainDocument.update({
        where: { id: doc.id },
        data: {
          status: "FAILED",
          metadata: { error: error instanceof Error ? error.message : "Extraction failed" },
        },
      });
    }
  }

  async importWebsite(organizationId: string, dto: ImportWebsiteDto) {
    await this.brainService.ensureInitialized(organizationId);

    const doc = await this.prisma.brainDocument.create({
      data: {
        organizationId,
        title: dto.title ?? new URL(dto.url).hostname,
        sourceUrl: dto.url,
        documentType: "WEBSITE",
        status: "PROCESSING",
      },
    });

    try {
      const res = await fetch(dto.url, {
        headers: { "User-Agent": "TorioBrainBot/1.0 (+https://torio.app)" },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const html = await res.text();
      const content = this.extractTextFromHtml(html);

      if (!content || content.length < 50) {
        throw new Error("Could not extract meaningful content from website");
      }

      return await this.prisma.brainDocument.update({
        where: { id: doc.id },
        data: {
          content: content.slice(0, 50000),
          status: "READY",
          metadata: {
            sourceUrl: dto.url,
            extractedAt: new Date().toISOString(),
            charCount: content.length,
          },
        },
      });
    } catch (error) {
      return await this.prisma.brainDocument.update({
        where: { id: doc.id },
        data: {
          status: "FAILED",
          metadata: { error: error instanceof Error ? error.message : "Import failed" },
        },
      });
    }
  }

  private resolveDocumentType(mime: string, filename: string): BrainDocumentType | null {
    const ext = path.extname(filename).toLowerCase();
    if (mime === "text/plain" || ext === ".txt") return "TXT";
    if (mime === "application/pdf" || ext === ".pdf") return "PDF";
    if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === ".docx"
    ) {
      return "DOCX";
    }
    return null;
  }

  private async extractText(
    buffer: Buffer,
    type: BrainDocumentType,
    filename: string,
  ): Promise<string> {
    if (type === "TXT") {
      return buffer.toString("utf-8").trim();
    }

    if (type === "PDF") {
      return this.extractPdfText(buffer);
    }

    if (type === "DOCX") {
      return this.extractDocxText(buffer);
    }

    throw new BadRequestException(`Unsupported document type: ${filename}`);
  }

  private extractPdfText(buffer: Buffer): string {
    const raw = buffer.toString("latin1");
    const parts: string[] = [];
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(raw)) !== null) {
      const chunk = match[1]
        .replace(/[^\x20-\x7E\n\r\t\u0980-\u09FF]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (chunk.length > 20) parts.push(chunk);
    }

    const text = [...new Set(parts)].join("\n").trim();
    if (text.length < 20) {
      throw new Error("Could not extract readable text from PDF");
    }
    return text.slice(0, 50000);
  }

  private extractDocxText(buffer: Buffer): string {
    const raw = buffer.toString("utf8");
    const matches = raw.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
    const text = matches
      .map((m) => m.replace(/<[^>]+>/g, ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 10) {
      throw new Error("Could not extract readable text from DOCX");
    }
    return text.slice(0, 50000);
  }

  private extractTextFromHtml(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  }
}
