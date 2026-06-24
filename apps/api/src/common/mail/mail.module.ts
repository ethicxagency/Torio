import { Global, Injectable, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = config.get<string>("SMTP_HOST");
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get<number>("SMTP_PORT") ?? 587,
        secure: false,
        auth: {
          user: config.get<string>("SMTP_USER"),
          pass: config.get<string>("SMTP_PASS"),
        },
      });
    }
  }

  async send(options: SendMailOptions): Promise<void> {
    const from = this.config.get<string>("SMTP_FROM") ?? "noreply@torio.app";

    if (!this.transporter) {
      console.log(`[Mail] To: ${options.to} | Subject: ${options.subject}`);
      return;
    }

    await this.transporter.sendMail({ from, ...options });
  }
}

@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
