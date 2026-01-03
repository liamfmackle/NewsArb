import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create demo users
  const passwordHash = await bcrypt.hash("password123", 12);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@newsarb.com" },
    update: {},
    create: {
      email: "demo@newsarb.com",
      passwordHash,
      displayName: "Demo User",
      balance: 500,
      kycStatus: "verified",
    },
  });

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      passwordHash,
      displayName: "Alice",
      balance: 250,
      kycStatus: "verified",
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      passwordHash,
      displayName: "Bob",
      balance: 175,
      kycStatus: "pending",
    },
  });

  console.log("Created users:", { demoUser: demoUser.email, alice: alice.email, bob: bob.email });

  // Sample stories with markets
  const stories = [
    {
      title: "Major Tech Company Announces Revolutionary AI Breakthrough",
      url: "https://techcrunch.com/ai-breakthrough",
      description: "A leading tech company has unveiled a new AI system that reportedly outperforms existing models by 300% on standard benchmarks. Industry experts are calling it a potential game-changer.",
      sourceDomain: "techcrunch.com",
      aiClassification: "technology",
    },
    {
      title: "Global Climate Summit Reaches Historic Agreement",
      url: "https://reuters.com/climate-summit-2024",
      description: "World leaders have signed a landmark climate accord pledging to reduce emissions by 50% by 2030. Environmental groups are cautiously optimistic about the binding commitments.",
      sourceDomain: "reuters.com",
      aiClassification: "politics",
    },
    {
      title: "Cryptocurrency Market Sees Unexpected Surge After Regulatory Clarity",
      url: "https://coindesk.com/crypto-surge",
      description: "Bitcoin and other major cryptocurrencies jumped 15% following new regulatory guidance from the SEC. Institutional investors are reportedly increasing their positions.",
      sourceDomain: "coindesk.com",
      aiClassification: "business",
    },
    {
      title: "Scientists Discover New Species in Deep Ocean Exploration",
      url: "https://nature.com/ocean-discovery",
      description: "Marine biologists have identified over 30 previously unknown species during a deep-sea expedition. The findings could reshape our understanding of ocean ecosystems.",
      sourceDomain: "nature.com",
      aiClassification: "science",
    },
    {
      title: "Viral Video Shows Incredible Rescue by Everyday Heroes",
      url: "https://bbc.com/viral-rescue",
      description: "A video capturing strangers working together to save a family from a car accident has garnered over 50 million views in 24 hours, sparking discussions about community spirit.",
      sourceDomain: "bbc.com",
      aiClassification: "breaking_news",
    },
    {
      title: "New Study Links Social Media Usage to Productivity Changes",
      url: "https://theverge.com/social-media-study",
      description: "Researchers have published findings suggesting that moderate social media use may actually increase workplace productivity, challenging previous assumptions.",
      sourceDomain: "theverge.com",
      aiClassification: "technology",
    },
    {
      title: "Sports Star Announces Surprise Retirement at Peak of Career",
      url: "https://espn.com/retirement-announcement",
      description: "One of the most decorated athletes in their sport has announced immediate retirement, citing a desire to focus on family and philanthropic work.",
      sourceDomain: "espn.com",
      aiClassification: "sports",
    },
    {
      title: "Major Movie Studio Reveals Ambitious Franchise Expansion Plans",
      url: "https://variety.com/studio-expansion",
      description: "A leading entertainment company has announced plans for 12 new films and 5 streaming series over the next three years, representing a $2 billion investment.",
      sourceDomain: "variety.com",
      aiClassification: "entertainment",
    },
  ];

  // Create stories with markets and some positions
  for (let i = 0; i < stories.length; i++) {
    const storyData = stories[i];

    // Check if story already exists
    const existingStory = await prisma.story.findFirst({
      where: { url: storyData.url },
    });

    if (existingStory) {
      console.log(`Story already exists: ${storyData.title.substring(0, 40)}...`);
      continue;
    }

    // Determine submitter (rotate between users)
    const submitter = i % 3 === 0 ? demoUser : i % 3 === 1 ? alice : bob;
    const initialStake = 20 + Math.floor(Math.random() * 30); // 20-50

    const story = await prisma.story.create({
      data: {
        ...storyData,
        submitterId: submitter.id,
        status: "active",
        safetyFlags: "[]",
      },
    });

    // Create market
    const market = await prisma.market.create({
      data: {
        storyId: story.id,
        totalPool: initialStake,
        participantCount: 1,
        status: "open",
      },
    });

    // Create initial position for submitter
    await prisma.position.create({
      data: {
        userId: submitter.id,
        marketId: market.id,
        stakeAmount: initialStake,
        entryPoolSize: initialStake,
        status: "active",
      },
    });

    // Record transaction
    await prisma.transaction.create({
      data: {
        userId: submitter.id,
        type: "stake",
        amount: -initialStake,
        referenceId: market.id,
      },
    });

    // Add some additional stakes to make markets more interesting
    if (i < 5) {
      // Add stakes from other users to first 5 stories
      const otherUsers = [demoUser, alice, bob].filter(u => u.id !== submitter.id);

      for (const user of otherUsers) {
        const additionalStake = 10 + Math.floor(Math.random() * 20); // 10-30
        const currentPool = market.totalPool + additionalStake;

        await prisma.position.create({
          data: {
            userId: user.id,
            marketId: market.id,
            stakeAmount: additionalStake,
            entryPoolSize: market.totalPool, // Pool size at time of entry
            status: "active",
          },
        });

        await prisma.market.update({
          where: { id: market.id },
          data: {
            totalPool: currentPool,
            participantCount: { increment: 1 },
          },
        });

        await prisma.transaction.create({
          data: {
            userId: user.id,
            type: "stake",
            amount: -additionalStake,
            referenceId: market.id,
          },
        });
      }
    }

    console.log(`Created story: ${storyData.title.substring(0, 40)}...`);
  }

  console.log("\nSeed completed!");
  console.log("\nDemo credentials:");
  console.log("  Email: demo@newsarb.com");
  console.log("  Password: password123");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
