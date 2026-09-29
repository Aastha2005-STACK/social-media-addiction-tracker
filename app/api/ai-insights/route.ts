import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { todayMinutes, dailyLimit, platformBreakdown, addictionScore } = body

    const geminiApiKey = process.env.GEMINI_API_KEY

    // If Gemini API Key is available, request real LLM generation
    if (geminiApiKey) {
      try {
        const prompt = `You are a digital wellness and mindful technology assistant for SocialTrack.
The user has recorded the following active screen time today:
- Today's Screen Time: ${Math.floor(todayMinutes / 60)}h ${todayMinutes % 60}m
- Daily Boundary Target: ${Math.floor(dailyLimit / 60)}h ${dailyLimit % 60}m
- Addiction Score: ${addictionScore}/100
- Platforms tracked: ${JSON.stringify(platformBreakdown || {})}

Provide a warm, concise (2 to 3 sentences maximum) personalized behavioral wellness advice to help the user stay balanced, avoid compulsive doomscrolling, and maintain productive offline habits. Do not mention prompts or technical details.`

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }],
                },
              ],
            }),
          }
        )

        if (res.ok) {
          const data = await res.json()
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            return NextResponse.json({ insight: text.trim(), source: "gemini" })
          }
        }
      } catch {
        // Fallback to heuristic wellness engine
      }
    }

    // Heuristic Fallback Wellness Engine (when Gemini API key is not yet set)
    let fallbackInsight = ""
    const breakdown = (platformBreakdown || {}) as Record<string, number>
    const sortedEntries: [string, number][] = Object.entries(breakdown).sort(
      (a, b) => Number(b[1]) - Number(a[1])
    )
    const topPlatform: [string, number] | undefined = sortedEntries[0]

    const platformName = topPlatform ? topPlatform[0] : "social media"
    const isOver = todayMinutes > dailyLimit

    if (todayMinutes === 0) {
      fallbackInsight =
        "Zero screen time tracked on supported platforms today. Great start! Remember to set an intention before you open YouTube, Instagram, or Reddit."
    } else if (isOver) {
      fallbackInsight = `You've exceeded your daily limit by ${todayMinutes - dailyLimit} minutes, with heavy usage on ${platformName}. Try putting your device into grayscale mode and stepping outside for a 15-minute screen-free walk.`
    } else if (topPlatform && topPlatform[0] === "YouTube" && topPlatform[1] > 60) {
      fallbackInsight = `YouTube represents your largest digital activity today (${topPlatform[1]}m). Consider switching from infinite auto-play to curated playlists or podcasts while doing active chores.`
    } else if (topPlatform && topPlatform[0] === "Instagram" && topPlatform[1] > 45) {
      fallbackInsight = `Notice if you are opening Instagram Reels out of boredom. Introducing a 10-second pause before opening the app can cut compulsive checking by up to 40%.`
    } else {
      fallbackInsight = `Your daily balance is healthy! You have ${Math.max(0, dailyLimit - todayMinutes)} minutes remaining within your target allowance. Keep prioritizing mindful breaks.`
    }

    return NextResponse.json({
      insight: fallbackInsight,
      source: "wellness_engine",
    })
  } catch {
    return NextResponse.json(
      {
        insight:
          "Remember to take a 10-minute eye break after every hour of screen usage. Hydrate and step away from your monitor.",
        source: "default",
      },
      { status: 200 }
    )
  }
}
