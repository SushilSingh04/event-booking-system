from email.message import EmailMessage
import logging
from typing import Optional
import aiosmtplib

from app.config import get_settings

logger = logging.getLogger(__name__)


async def send_booking_confirmation_email(
    user_email: str,
    user_name: str,
    event_title: str,
    seats: int,
    total_amount: float,
    ticket_code: str,
    event_date: str,
    venue: str,
) -> bool:
    """
    Send an asynchronous booking confirmation email using aiosmtplib.
    Falls back gracefully to structured logging if SMTP is not configured or encounters errors.
    """
    settings = get_settings()

    subject = f"Booking Confirmed: {event_title} ({ticket_code})"
    plain_content = f"""Hello {user_name},

Your booking for '{event_title}' has been successfully confirmed!

Booking Details:
- Ticket Code: {ticket_code}
- Seats Reserved: {seats}
- Total Amount: ${total_amount:.2f}
- Event Date: {event_date}
- Venue: {venue}

You can download your ticket QR code anytime from your account dashboard.

Thank you for booking with us!
{settings.APP_NAME} Team
"""

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #4F46E5;">Booking Confirmation</h2>
          <p>Hi <strong>{user_name}</strong>,</p>
          <p>Your tickets for <strong>{event_title}</strong> have been confirmed.</p>
          
          <div style="background-color: #F3F4F6; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Ticket Code:</strong> <span style="font-family: monospace; font-size: 1.1em; color: #1F2937;">{ticket_code}</span></p>
            <p style="margin: 5px 0;"><strong>Seats:</strong> {seats}</p>
            <p style="margin: 5px 0;"><strong>Total Paid:</strong> ${total_amount:.2f}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> {event_date}</p>
            <p style="margin: 5px 0;"><strong>Venue:</strong> {venue}</p>
          </div>

          <p style="font-size: 0.9em; color: #6B7280;">Please arrive 15 minutes before the event with your ticket QR code ready for scanning.</p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
          <p style="font-size: 0.8em; color: #9CA3AF;">{settings.APP_NAME}</p>
        </div>
      </body>
    </html>
    """

    # Check if real SMTP credentials are provided (ignoring default example templates)
    is_smtp_configured = bool(
        settings.SMTP_HOST
        and settings.SMTP_USERNAME
        and settings.SMTP_USERNAME != "user@example.com"
        and settings.SMTP_PASSWORD
        and settings.SMTP_PASSWORD != "secret"
    )

    if not is_smtp_configured:
        logger.info(
            "SMTP is not configured. Fallback: logged confirmation email for '%s' locally:\n%s",
            user_email,
            plain_content,
        )
        return True

    # Build MIME Email message
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = user_email
    message["Subject"] = subject
    message.set_content(plain_content)
    message.add_alternative(html_content, subtype="html")

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            start_tls=settings.SMTP_STARTTLS,
            timeout=5.0,
        )
        logger.info("Confirmation email sent to '%s' for ticket '%s'.", user_email, ticket_code)
        return True
    except Exception as exc:
        logger.warning(
            "Failed to send confirmation email via SMTP (%s). Fallback: logged locally instead:\n%s",
            exc,
            plain_content,
        )
        return True
