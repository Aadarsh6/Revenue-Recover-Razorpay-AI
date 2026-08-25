import "dotenv/config"
import crypto from "crypto"
import prisma from "../lib/prismaClient"

const EVENT_ID = "TU4MOzmGgACoWi"

async function main() {
  // Get the original webhook from our database
  const event = await prisma.webhookEvent.findUnique({
    where: {
      eventId: EVENT_ID,
    },
  })

  if (!event) {
    throw new Error(`Event ${EVENT_ID} not found`)
  }

  // Recreate the JSON body we are going to send
  const rawBody = JSON.stringify(event.payload)

  // Generate a valid Razorpay-style signature
  const signature = crypto
    .createHmac(
      "sha256",
      process.env.RAZORPAY_WEBHOOK_SECRET as string
    )
    .update(rawBody)
    .digest("hex")

  console.log("Replaying event:", EVENT_ID)
  console.log("Signature:", signature)

  // Send the webhook back to our local server
  const response = await fetch("http://localhost:3000/webhook/razorpay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": EVENT_ID,
    },
    body: rawBody,
  })

  console.log("HTTP status:", response.status)
  console.log("Response:", await response.text())
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })