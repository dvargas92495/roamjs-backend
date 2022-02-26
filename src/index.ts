import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import toConfigPageName from "roamjs-components/util/toConfigPageName";
import runExtension from "roamjs-components/util/runExtension";

const ID = "base";
const CONFIG = toConfigPageName(ID);
runExtension(ID, () => {
  createConfigObserver({ title: CONFIG, config: { tabs: [] } });
});
