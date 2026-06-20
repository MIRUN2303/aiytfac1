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
        content_templates = {
            "Hook": hook,
            "Introduction": f"Today we're diving deep into {safe_topic}. {summary or f'This is a fascinating subject that deserves our full attention.'} "
                           f"We'll explore every aspect and uncover what makes {safe_topic} so important in today's world.",
            "Overview": f"Let's start with a broad overview of {safe_topic}. This topic encompasses many fascinating aspects "
                        f"that affect how we understand the world around us. From its origins to its modern-day implications, "
                        f"there's much to explore and discover.",
            "Historical Context": f"The history of {safe_topic} dates back further than most people realize. "
                                  f"Understanding this background is crucial for appreciating its current significance. "
                                  f"Early developments shaped how we perceive and interact with {safe_topic} today.",
            "Main Story": f"At the heart of {safe_topic} lies an incredible story. The journey from its beginnings "
                          f"to its current state is filled with remarkable developments, unexpected turns, "
                          f"and insights that challenge our conventional understanding.",
            "Conflict": f"However, {safe_topic} is not without controversy. There are competing perspectives "
                        f"and ongoing debates that make this subject particularly compelling. "
                        f"Understanding these tensions is key to grasping the full picture.",
            "Core Concept": f"The fundamental concept behind {safe_topic} is both simple and profound. "
                            f"At its core, it teaches us about {summary or 'the interconnected nature of knowledge and discovery'}. "
                            f"Let's break this down into understandable pieces.",
            "Climax": f"Everything builds to this moment. The most dramatic revelation about {safe_topic} "
                      f"is one that changes how we see everything. This is the turning point that makes "
                      f"this story so unforgettable.",
            "Key Evidence": f"The evidence supporting our understanding of {safe_topic} is compelling. "
                            f"Research and discoveries have consistently shown that {safe_topic} "
                            f"plays a crucial role in {summary or 'shaping our understanding of the world'}.",
            "Analysis": f"When we analyze {safe_topic} more deeply, patterns emerge that reveal "
                        f"deeper truths. The implications are far-reaching and affect multiple areas of our lives. "
                        f"Experts continue to study and debate these findings.",
            "Examples": f"Let's look at some concrete examples that illustrate {safe_topic}. "
                        f"These real-world cases demonstrate the principles in action "
                        f"and help us understand why this matters.",
            "Deep Dive": f"Going deeper into {safe_topic}, we discover nuances that casual observers miss. "
                         f"The complexity and richness of this subject reward those who take the time "
                         f"to truly understand its intricacies.",
            "Expert Insights": f"Leading experts in the field of {safe_topic} have shared valuable insights. "
                               f"Their perspectives help us understand the bigger picture and "
                               f"appreciate the depth of this fascinating subject.",
            "Common Mistakes": f"Many people misunderstand key aspects of {safe_topic}. "
                               f"Let's address some of the most common misconceptions and clarify "
                               f"what the evidence actually tells us.",
            "Ending": f"As we conclude our exploration of {safe_topic}, we're left with a deeper appreciation "
                      f"for its significance. The journey through this topic reminds us that "
                      f"there's always more to learn and discover.",
            "Summary": f"To summarize what we've learned about {safe_topic}: it's a rich, complex subject "
                       f"that touches many aspects of our lives. The key takeaways are clear and "
                       f"demonstrate why this topic deserves our attention.",
            "Reflection": f"Reflecting on {safe_topic}, we see how it connects to broader themes "
                          f"in our world. The lessons we've learned here apply far beyond "
                          f"the subject itself.",
            "Call to Action": f"If you found this exploration of {safe_topic} valuable, "
                              f"please like, share, and subscribe for more deep dives. "
                              f"Let us know in the comments: what aspect of {safe_topic} "
                              f"would you like us to explore next?",
            "Practice": f"Now that you understand {safe_topic}, we encourage you to explore further. "
                        f"There are many resources available for those who want to deepen their knowledge. "
                        f"Start with the topics we've covered today and build from there.",
            "Inspiration": f"The story of {safe_topic} reminds us that knowledge is power. "
                           f"Every great discovery starts with curiosity. Keep asking questions, "
                           f"keep exploring, and never stop learning.",
        }
        for key, template_text in content_templates.items():
            if key.lower() in section_name.lower() or section_name.lower() in key.lower():
                return template_text
        return f"{section_name}: When exploring {safe_topic}, we discover fascinating details that enrich our understanding. " \
                f"This aspect of the topic reveals important insights about {summary or 'the subject at hand'}."

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
