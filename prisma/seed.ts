/**
 * Optional demo data for local development. Run with `npm run seed`.
 * Safe to run multiple times — it only inserts if the library is empty.
 */
import { PrismaClient } from "@prisma/client";
import { amountToCents, rateToMicros } from "../src/lib/money";

const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", rateMicros: rateToMicros(130) },
  });

  const accommodationCount = await prisma.accommodation.count();
  if (accommodationCount === 0) {
    const samburu = await prisma.accommodation.create({
      data: {
        name: "Samburu Intrepids",
        location: "Samburu",
        currency: "USD",
        pricingBasis: "PER_PERSON",
        roomTypes: { create: [{ name: "Deluxe Tent", sortOrder: 0 }] },
      },
      include: { roomTypes: true },
    });
    const deluxeTent = samburu.roomTypes[0];
    await prisma.accommodationRate.createMany({
      data: [
        {
          accommodationId: samburu.id,
          roomTypeId: deluxeTent.id,
          season: "LOW",
          mealPlan: "FB",
          adultSharingCents: amountToCents(150),
          child5to12Cents: amountToCents(90),
          childUnder5Cents: 0,
          singleCents: amountToCents(190),
        },
        {
          accommodationId: samburu.id,
          roomTypeId: deluxeTent.id,
          season: "HIGH",
          mealPlan: "FB",
          adultSharingCents: amountToCents(220),
          child5to12Cents: amountToCents(130),
          childUnder5Cents: 0,
          singleCents: amountToCents(280),
        },
      ],
    });

    const villa = await prisma.accommodation.create({
      data: {
        name: "Karen Boutique Hotel",
        location: "Nairobi",
        currency: "USD",
        pricingBasis: "PER_ROOM",
        roomTypes: { create: [{ name: "Standard Room", sortOrder: 0 }] },
      },
      include: { roomTypes: true },
    });
    await prisma.accommodationRate.create({
      data: {
        accommodationId: villa.id,
        roomTypeId: villa.roomTypes[0].id,
        season: "LOW",
        mealPlan: "BB",
        standardRoomCents: amountToCents(120),
        singleRoomCents: amountToCents(160),
      },
    });

    await prisma.transportRate.createMany({
      data: [
        { vehicleType: "VAN", priceCents: amountToCents(150), currency: "USD" },
        { vehicleType: "JEEP_5PAX", priceCents: amountToCents(180), currency: "USD" },
        { vehicleType: "JEEP_8PAX", priceCents: amountToCents(220), currency: "USD" },
      ],
    });

    await prisma.trainJourney.create({
      data: {
        route: "Nairobi → Mombasa",
        firstClassCents: amountToCents(60),
        secondClassCents: amountToCents(40),
        currency: "USD",
      },
    });

    await prisma.transferRate.create({
      data: { route: "Nairobi Airport → Karen", priceCents: amountToCents(35), currency: "USD" },
    });

    await prisma.activityRate.create({
      data: { name: "Hell's Gate Cycling", location: "Naivasha", priceCents: amountToCents(35), currency: "USD" },
    });

    await prisma.flightRate.create({
      data: { route: "Nairobi → Samburu", priceCents: amountToCents(220), currency: "USD" },
    });

    console.log("Seeded demo Rate Library data.");
  } else {
    console.log("Rate Library already has data — skipping seed.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
