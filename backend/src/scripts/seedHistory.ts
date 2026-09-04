import "dotenv/config";
import prisma from "../lib/prismaClient";

async function main() {
  // Find the contact/email from your last successful test payment
  // (the one you paid for the GUARD test — it's already in PaymentRecord)
  // const ref = await prisma.paymentRecord.findFirst({
  //   where: { status: "captured" },
  //   orderBy: { createdAt: "desc" },
  // });
  // const contact = ref?.contact ?? "+919865745635";
  // const email = ref?.email ?? "void@razorpay.com";

  const contact = "+919865745635";
  const email = "void@razorpay.com";


  console.log(`Seeding history for contact: "${contact}" / email: "${email}"`);
  console.log(`⚠️  You MUST enter EXACTLY this contact + email on the payment form in Part B.`);

  for (let i = 0; i < 4; i++) {
    await prisma.paymentRecord.upsert({
      where: { paymentId: `seed_hist_${i}` },
      update: {
        contact,
        email,
        status: "captured",
      },
      create: {
        paymentId: `seed_hist_${i}`,
        contact,
        email,
        amount: 10000 + i * 100,
        currency: "INR",
        method: i === 3 ? "card" : "upi",
        status: "captured",
      },
    });
  }

  console.log(`✅ Seeded 4 captured payments. History ready.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());