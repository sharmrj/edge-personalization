import { ProcessedData } from "./target/target";
import { HtmlRewritingStream } from 'html-rewriter';

const COMMANDS_KEYS = {
  remove: 'remove',
  replace: 'replace',
  updateAttribute: 'updateattribute',
};

export const rewrite = async (response, data: ProcessedData): Promise<Response> => {
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

  const rewriter = new HtmlRewritingStream().onElement("head", {
    element(element) {
      element.append('<meta name="edge-personalized" content="true" />')
      element.append(
        `<script>window.edgePersonalizationApplied = true;</script>`,
      )
    },
  });

  for (const cmd of transformedData) {
    const { action, selector, content, attribute, type, path } = cmd;

    if (type === "fragment") {
      const fragmentHTML = await fetchFragmentContent(path);
      if (!fragmentHTML) continue;

      rewriter.onElement(selector, {
        element(element) {
          element.replaceChildren(fragmentHTML);
        },
      });

      continue;
    }

    rewriter.onElement(selector, {
      element(element) {
        if (action === "remove") {
          element.remove();
        } else if (action === "replace") {
          element.replaceChildren(content);
        } else if (action === "updateAttribute" && attribute) {
          element.setAttribute(attribute, content);
        }
      },
    });
  }
  return response.pipeThrough(rewriter);
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

function modifySelectorTerm(termParam) {
  let term = termParam;
  const specificSelectors = {
    section: 'main > div',
    'primary-cta': 'strong a',
    'secondary-cta': 'em a',
    'action-area': '*:has(> em a, > strong a)',
    'any-marquee-section': 'main > div:has([class*="marquee"])',
    'any-marquee': '[class*="marquee"]',
    'any-header': ':is(h1, h2, h3, h4, h5, h6)',
  };
  const otherSelectors = ['row', 'col'];
  const htmlEls = [
    'html', 'body', 'header', 'footer', 'main',
    'div', 'a', 'p', 'strong', 'em', 'picture', 'source', 'img', 'h',
    'ul', 'ol', 'li',
  ];
  const startTextMatch = term.match(/^[a-zA-Z/./-]*/);
  const startText = startTextMatch ? startTextMatch[0].toLowerCase() : '';
  const startTextPart1 = startText.split(/\.|:/)[0];
  const endNumberMatch = term.match(/[0-9]*$/);
  const endNumber = endNumberMatch && startText.match(/^[a-zA-Z]/) ? endNumberMatch[0] : '';
  if (!startText || htmlEls.includes(startText)) return term;
  const updateEndNumber = (endNumber, term) => (endNumber
    ? term.replace(endNumber, `:nth-child(${endNumber})`)
    : term);
  if (otherSelectors.includes(startText)) {
    term = term.replace(startText, '> div');
    term = updateEndNumber(endNumber, term);
    return term;
  }
  if (Object.keys(specificSelectors).includes(startTextPart1)) {
    term = term.replace(startTextPart1, specificSelectors[startTextPart1]);
    term = updateEndNumber(endNumber, term);
    return term;
  }

  if (!startText.startsWith('.')) term = `.${term}`;
  if (endNumber) {
    term = term.replace(endNumber, '');
    term = `${term}:nth-child(${endNumber} of ${term})`;
  }
  return term;
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
