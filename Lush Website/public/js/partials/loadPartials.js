import loadHeader from "../header/loadHeader.js";
import loadFooter from "./loadFooter.js";
import showPage from "./loadContent.js";
import { headerS } from "../header/loadDropdowns.js";

loadHeader();
// loadFooter();

showPage(location.href);

window.onpopstate = function (event) {
  if (event.state) {
    // console.log(e.state);
    showPage(event.state.pathname, true);
  }
};
