import { ProcessedData } from "./target/target";

export const constructRewriter = async (data: ProcessedData) => {
  const transformedData = await Promise.all(
    data?.commands?.map(async (cmd) => {
      // let modified = modifySelectorTerm(cmd.selector);
      if (cmd.type === "fragment") {
        return { ...cmd, type: "fragment", path: cmd.path };
      }
      let { modifiedSelector, modifiers, attribute } = modifyNonFragmentSelector(cmd.selector, cmd.action);
      return { ...cmd, selector: modifiedSelector, attribute };
    })
  );

  const rewriter = new HTMLRewriter().on("head", {
    element(element) {
      element.append('<meta name="edge-personalized" content="true" />', { html: true })
      element.append(
        `<script>window.edgePersonalizationApplied = true;</script>`,
        { html: true }
      )
    },
  });

  for (const cmd of transformedData) {
    const { action, selector, content, attribute, type, path } = cmd;

    if (type === "fragment") {
      const fragmentHTML = await fetchFragmentContent(path);
      if (!fragmentHTML) continue;

      rewriter.on(selector, {
        element(element) {
          element.setInnerContent(fragmentHTML, { html: true });
        },
      });

      continue;
    }

    rewriter.on(selector, {
      element(element) {
        if (action === "remove") {
          element.remove();
        } else if (action === "replace") {
          element.setInnerContent(content, { html: true });
        } else if (action === "updateAttribute" && attribute) {
          element.setAttribute(attribute, content);
        }
      },
    });
  }
  return rewriter;
};

function modifyNonFragmentSelector(selector, action) {
  const { sel, modifiers } = getModifiers(selector);

  let modifiedSelector = sel
    .split('>').join(' > ')
    .split(',').join(' , ')
    .replaceAll(/main\s*>?\s*(section\d*)/gi, '$1')
    .split(/\s+/)
    .map(modifySelectorTerm)
    .join(' ')
    .trim();

  let attribute;

  if (action === COMMANDS_KEYS.updateAttribute) {
    const string = modifiedSelector.split(' ').pop();
    attribute = string.replace('.', '');
    modifiedSelector = modifiedSelector.replace(string, '').trim();
  }

  return {
    modifiedSelector,
    modifiers,
    attribute,
  };
}

function getModifiers(selector) {
  let sel = selector;
  const modifiers = [];
  const flags = sel.split(/\s+#_/);
  if (flags.length) {
    sel = flags.shift();
    flags.forEach((flag) => {
      flag.split(/_|#_/).forEach((mod) => modifiers.push(mod.toLowerCase().trim()));
    });
  }
  return { sel, modifiers };
}
