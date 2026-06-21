import random
import json
import os

STORY_TEMPLATES = {
    "narrative": {
        "structure": [
            "Hook - Open with a compelling question or shocking fact",
            "Introduction - Provide context about the topic",
            "Main Story - Develop the narrative with key details",
            "Conflict - Present the central tension or mystery",
            "Climax - Reveal the most dramatic revelation",
            "Ending - Conclude with reflection",
            "Call to Action - Encourage viewer engagement",
        ],
    },
    "documentary": {
        "structure": [
            "Overview - Present the big picture",
            "Historical Context - Explore origins and background",
            "Key Evidence - Present facts and discoveries",
            "Analysis - Examine implications",
            "Expert Insights - Include perspectives",
            "Conclusion - Summarize findings",
            "Call to Action - What viewers can do next",
        ],
    },
    "educational": {
        "structure": [
            "Question - Pose a learning objective",
            "Core Concept - Introduce the main idea",
            "Examples - Provide concrete illustrations",
            "Deep Dive - Explore nuances",
            "Common Mistakes - Address misconceptions",
            "Summary - Recap key points",
            "Practice - Suggest further exploration",
        ],
    },
    "cinematic": {
        "structure": [
            "Cold Open - Start with a breathtaking moment",
            "Setup - Establish the world and characters",
            "Rising Action - Build tension and stakes",
            "Twist - Reveal unexpected information",
            "Climax - Peak emotional intensity",
            "Falling Action - Consequences unfold",
            "Resolution - Satisfying conclusion",
        ],
    },
    "emotional": {
        "structure": [
            "Empathy Hook - Connect emotionally",
            "Personal Story - Share a relatable experience",
            "Struggle - Describe challenges faced",
            "Turning Point - The moment of change",
            "Triumph - Celebrate the victory",
            "Reflection - Share lessons learned",
            "Inspiration - Encourage the viewer",
        ],
    },
    "comedic": {
        "structure": [
            "Funny Hook - Start with a laugh",
            "Setup - Introduce the absurd situation",
            "Escalation - Make it more ridiculous",
            "Twist - Unexpected punchline",
            "Fallout - Hilarious consequences",
            "Callback - Reference earlier joke",
            "Finale - End on a high note",
        ],
    },
}

HOOK_TEMPLATES = [
    "What if everything you knew about {topic} was wrong?",
    "The untold story of {topic} will shock you.",
    "This is why {topic} matters more than you think.",
    "You won't believe what {topic} is really about.",
    "The hidden truth behind {topic} revealed.",
    "Why {topic} is changing everything we know.",
    "Discover the secrets of {topic} that nobody talks about.",
    "What they don't tell you about {topic}.",
    "The incredible reality of {topic} exposed.",
    "Everything you thought about {topic} is about to change.",
]


def generate_story(topic: str, summary: str, story_style: str = "narrative") -> dict:
    template = STORY_TEMPLATES.get(story_style, STORY_TEMPLATES["narrative"])

    words = topic.split()
    safe_topic = topic[:60]
    title_template = random.choice([
        f"The Truth About {safe_topic}",
        f"{safe_topic}: The Full Story",
        f"What You Need to Know About {safe_topic}",
        f"The Complete Guide to {safe_topic}",
        f"{safe_topic} Explained",
    ])
    title = title_template

    hook = random.choice(HOOK_TEMPLATES).format(topic=safe_topic)



    def generate_section_content(section_title: str) -> str:
        section_name = section_title.split(" - ")[0] if " - " in section_title else section_title
        concept = (summary or safe_topic).rstrip(".").split(".")[0].strip().rstrip(",")
        content_templates = {
            "Hook": (
                f"Think about this for a second. {hook} "
                f"Because the reality is, most people have no idea what {safe_topic} actually means. "
                f"And that's exactly why you need to hear this — it might change the way you see everything."
            ),
            "Introduction": (
                f"So what is {safe_topic} really about? "
                f"{concept}. "
                f"But here's what nobody tells you: it's not just some abstract concept. "
                f"It shows up in your daily life in ways you've probably never noticed, "
                f"and once you start paying attention, you'll see it everywhere."
            ),
            "Overview": (
                f"Let's zoom out for a moment. When we look at {safe_topic} from a distance, "
                f"a pattern emerges. {concept}. "
                f"This isn't just trivia — understanding this changes how we navigate "
                f"the world around us, and it's more relevant today than ever before."
            ),
            "Historical Context": (
                f"To really get {safe_topic}, you have to understand where it came from. "
                f"The roots go deeper than most people realize. "
                f"Early thinkers wrestled with the same questions we're asking today. "
                f"The difference? They saw it from a perspective we've lost — "
                f"and recovering that perspective might be the key to making sense of it all."
            ),
            "Main Story": (
                f"At its core, {safe_topic} tells us something profound about ourselves. "
                f"{concept}. "
                f"This isn't just a story about a concept — it's a story about human nature. "
                f"About the choices we make, the patterns we repeat, and the truths we avoid. "
                f"And that's what makes it so compelling."
            ),
            "Conflict": (
                f"Now here's where things get uncomfortable. "
                f"Not everyone agrees on what {safe_topic} actually means. "
                f"There are real tensions, real contradictions at its heart. "
                f"{concept}. "
                f"The conflict isn't a bug — it's the point. "
                f"Because the things that challenge us are the things that teach us the most."
            ),
            "Core Concept": (
                f"Let me break this down simply. "
                f"The core idea behind {safe_topic} is actually something you already know intuitively. "
                f"{concept}. "
                f"When you strip away all the jargon and complexity, "
                f"it comes down to a truth that's been staring us in the face the whole time."
            ),
            "Climax": (
                f"Here it is. The moment everything clicks. "
                f"Because when you really understand {safe_topic}, "
                f"you realize it's not about the thing itself — it's about us. "
                f"{concept}. "
                f"Once you see this, you can't unsee it. "
                f"This is the turning point that reframes everything we've talked about."
            ),
            "Key Evidence": (
                f"People ask: is this actually real, or is it just theory? "
                f"The evidence is overwhelming. {concept}. "
                f"Research consistently shows that {safe_topic} is far more important "
                f"than most people realize. Study after study points to the same conclusion — "
                f"and the data is something we can't afford to ignore."
            ),
            "Analysis": (
                f"Let's dig deeper. When you analyze {safe_topic} carefully, "
                f"something fascinating happens. "
                f"{concept}. "
                f"The patterns reveal themselves, and suddenly you see connections "
                f"you never noticed before — between this topic and your life, "
                f"between the past and the present, between theory and reality."
            ),
            "Examples": (
                f"Here's where it gets concrete. Think about {safe_topic} in action. "
                f"{concept}. "
                f"These aren't hypotheticals — these are real situations that play out every day. "
                f"Once you know what to look for, you'll start spotting these patterns everywhere."
            ),
            "Deep Dive": (
                f"If you really want to understand {safe_topic}, you have to go beneath the surface. "
                f"The surface-level takes are easy — everyone has one. "
                f"But the real insight is in the nuance. {concept}. "
                f"This is where casual observers check out and true understanding begins."
            ),
            "Expert Insights": (
                f"The people who've spent years studying {safe_topic} all say something similar. "
                f"{concept}. "
                f"Experts across different fields keep arriving at the same conclusion, "
                f"which tells you this isn't just opinion — it's something deeper, "
                f"something that keeps showing up no matter how you approach it."
            ),
            "Common Mistakes": (
                f"Here's the thing most people get wrong about {safe_topic}. "
                f"They think it's simple. They think they already understand it. "
                f"But here's the truth: {concept}. "
                f"The biggest misconception is the one that keeps us from seeing the truth "
                f"that's been right in front of us the whole time."
            ),
            "Ending": (
                f"So where does that leave us? "
                f"{safe_topic} isn't just something you learn once and move on from. "
                f"{concept}. "
                f"The question now is: what are you going to do with this understanding? "
                f"Because knowing and acting are two different things — "
                f"and the real value is in what you do next."
                f"\n\nEnding Text on Screen:"
                f"\n\"Understanding {safe_topic} changes how you see everything.\""
            ),
            "Summary": (
                f"Here's what it all comes down to. "
                f"{concept}. "
                f"That's the thread that connects everything we've explored today. "
                f"It's not complicated — it's just easy to miss when you're not looking for it. "
                f"Now that you see it, hold onto it."
            ),
            "Reflection": (
                f"Take a moment to think about this. "
                f"{safe_topic} reflects something about our world that's easy to ignore "
                f"but impossible to unsee once you notice. {concept}. "
                f"The lessons here extend far beyond the subject itself — "
                f"they touch on how we live, how we think, and who we are."
            ),
            "Call to Action": (
                f"If this resonated with you — if {safe_topic} touched something in you — "
                f"share this with someone who needs to hear it. "
                f"Drop a comment: what part of this hit closest to home for you? "
                f"And if you want more deep dives like this, subscribe. "
                f"We're just getting started."
            ),
            "Practice": (
                f"Don't just take my word for it. Go explore {safe_topic} on your own. "
                f"{concept}. "
                f"The best way to really understand is to engage with it directly. "
                f"Start with what we covered today and see where your curiosity takes you."
            ),
            "Inspiration": (
                f"The real power of {safe_topic} isn't in the facts — it's in what it awakens in us. "
                f"{concept}. "
                f"Every great idea starts with someone asking a question. "
                f"Keep asking. Keep exploring. That curiosity is what moves us forward."
            ),
        }
        for key, template_text in content_templates.items():
            if key.lower() in section_name.lower() or section_name.lower() in key.lower():
                return template_text
        return (
            f"When you look at {safe_topic} through the right lens, something shifts. "
            f"{concept}. "
            f"The {section_name} isn't just a moment in a story — "
            f"it's a reflection of patterns you've seen in your own life, "
            f"often without realizing it. That recognition is the whole point."
        )

    sections = []
    total_duration = 0
    for i, section_line in enumerate(template["structure"]):
        section_title = section_line.split(" - ")[0] if " - " in section_line else section_line
        section_name_full = section_line
        content = generate_section_content(section_title)
        est_duration = random.randint(30, 60)
        total_duration += est_duration
        sections.append({
            "section": i + 1,
            "title": section_title,
            "full_title": section_name_full,
            "content": content,
            "estimated_duration_seconds": est_duration,
        })

    keywords = [safe_topic.lower()] + ["explained", "documentary", "analysis", "deep dive", "educational",
                                         "story", "facts", "guide", "overview", "complete"]
    keywords = list(set(keywords))

    tags = [safe_topic, "Documentary", "Educational", "Explained", "Storytelling"]
    hashtag_base = "".join(w.capitalize() for w in safe_topic.split())
    hashtags = [f"#{hashtag_base}", f"#{hashtag_base}Documentary", "#Educational", "#DeepDive"]

    chapters = []
    chapter_timestamps = []
    running_time = 0
    for sec in sections:
        chapters.append(sec["title"])
        chapter_timestamps.append(f"{running_time // 60}:{running_time % 60:02d}")
        running_time += sec["estimated_duration_seconds"]

    seo_description = f"Discover the fascinating story of {safe_topic}. {summary or 'An in-depth exploration.'} " \
                       f"Includes expert analysis, surprising revelations, and comprehensive coverage. " \
                       f"Perfect for anyone interested in learning more about this important topic."

    return {
        "topic": safe_topic,
        "summary": summary or f"An in-depth exploration of {safe_topic}",
        "style": story_style,
        "title": title,
        "hook": hook,
        "introduction": sections[1]["content"] if len(sections) > 1 else sections[0]["content"],
        "main_story": next((s["content"] for s in sections if "Main Story" in s["full_title"] or "Core" in s["title"]), sections[2]["content"]),
        "conflict": next((s["content"] for s in sections if "Conflict" in s["full_title"] or "Twist" in s["title"]), ""),
        "climax": next((s["content"] for s in sections if "Climax" in s["full_title"] or "climax" in s["title"].lower()), sections[-3]["content"]),
        "ending": next((s["content"] for s in sections if "Ending" in s["full_title"] or "Summary" in s["title"] or "Conclusion" in s["title"]), sections[-2]["content"]),
        "call_to_action": next((s["content"] for s in sections if "Call to Action" in s["full_title"]), sections[-1]["content"]),
        "seo_description": seo_description,
        "thumbnail_text": f"{safe_topic}: The Full Story",
        "keywords": keywords,
        "tags": tags,
        "hashtags": hashtags,
        "pinned_comment": f"What do you think about {safe_topic}? Share your thoughts in the comments below! "
                          f"Don't forget to like and subscribe for more content like this.",
        "video_category": "Education",
        "chapters": chapters,
        "chapter_timestamps": chapter_timestamps,
        "total_duration_seconds": total_duration,
        "sections": sections,
    }
