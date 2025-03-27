import { ProcessedData } from "./target";

export function parseRawData(targetData: unknown): ProcessedData {
  // Extract personalization decisions
  const propositions = targetData?.handle?.find(d => d.type === "personalization:decisions")?.payload || []
  console.log("Propositions:", propositions);

  if (propositions.length === 0) {
    console.log("No propositions found in Target response")
    return { fragments: [], commands: [] }
  }

  console.log(`Found ${propositions.length} propositions`)

  // Process propositions to extract fragments and commands
  const fragments = []
  const commands = []

  propositions.forEach(proposition => {
    proposition.items?.forEach(item => {
      if (item.data?.format === "application/json") {
        const content = item.data.content
        if (content?.manifestContent) {
          const experiences = content.manifestContent?.experiences?.data || content.manifestContent?.data || []

          experiences.forEach(experience => {
            const action = experience.action
              ?.toLowerCase()
              .replace("content", "")
              .replace("fragment", "")
              .replace("tosection", "")

            const selector = experience.selector
            const variantNames = Object.keys(experience).filter(
              key => !["action", "selector", "pagefilter", "page filter", "page filter optional"].includes(
                key.toLowerCase()
              )
            )

            variantNames.forEach(variant => {
              if (!experience[variant] || experience[variant].toLowerCase() === "false") return

              if (getSelectorType(selector) === "fragment") {
                fragments.push({
                  selector: normalizePath(selector.split(" #_")[0]),
                  val: normalizePath(experience[variant]),
                  action,
                  manifestId: content.manifestPath,
                  targetManifestId: item.meta?.["activity.name"]
                })
              } else if (action === "remove" || action === "replace" || action === "updateattribute") {
                commands.push({
                  action,
                  selector,
                  content: experience[variant],
                  selectorType: getSelectorType(selector),
                  manifestId: content.manifestPath,
                  targetManifestId: item.meta?.["activity.name"]
                })
              }
            })
          })
        }
      }
    })
  })

  return { fragments, commands }
};

// Helper function to determine selector type
function getSelectorType(selector) {
  const sel = selector?.toLowerCase().trim()
  if (sel?.startsWith("/") || sel?.startsWith("http")) return "fragment"
  return "other"
}
