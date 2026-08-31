import "dotenv/config"
import prisma from "../lib/prismaClient"

const EVENT_ID = "TU4MOzmGgACoWi"
const replayEventId = `replay-${EVENT_ID}-${Date.now()}`;

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
    const signature = "This is  a fake signature"

  console.log("Replaying event:", EVENT_ID)
  console.log("Signature:", signature)

  // Send the webhook back to our local server
  const response = await fetch("http://localhost:3000/webhook/razorpay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": replayEventId,
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