
"use strict";

// load the same page into an iframe
function update_page()
{
  var iframe = document.createElement('iframe');
  iframe.style.display = "none";
  iframe.src = document.URL;
  document.body.appendChild(iframe);
}

function failure_ids(node)
{
  var ids = [];
  node.querySelectorAll("*[id^='failure_id:']").forEach( (item) => {
    ids.push(item.id)
  });
  return ids;
}

function new_items(old_array, new_array)
{
  var new_items = new_array.filter(function(item) {
    return old_array.indexOf(item) < 0;
  });

  return new_items;
}

function new_issues_text(count)
{
  var ret = count + " new issue";

  if (count != 1)
    ret = ret.concat("s");

  return ret;
}

function amount_str(count, str)
{
  var ret = count + " " + str;
  if (count != 1)
    ret += "s";

  return ret;
}

function create_notification(new_issues) {
  var jenkins_failures = 0;
  var obs_failures = 0;
  var obs_declined_sr = 0;
  var docker_failures = 0;

  new_issues.forEach( (id) => {
    console.log(id);
    if (id.match(/^failure_id:jenkins:/))
      jenkins_failures++;
    else if (id.match(/^failure_id:obs_build:/))
      obs_failures++;
    else if (id.match(/^failure_id:declined_sr:/))
      obs_declined_sr++;
    else if (id.match(/^failure_id:docker:/))
      docker_failures++;
    else
      console.warn("Unknown issue id: ", id);
  });

  var message = "";

  if (jenkins_failures > 0)
    message += amount_str(jenkins_failures, "new Jenkins build failure") + "\n";
  if (obs_failures > 0)
    message += amount_str(obs_failures, "new OBS build failure") + "\n";
  if (obs_declined_sr > 0)
    message += amount_str(obs_declined_sr, "new declined OBS submit request") + "\n";
  if (docker_failures > 0)
    message += amount_str(docker_failures, "new Docker build failure") + "\n";

  var options = {
    body: message,
    icon: "https://avatars3.githubusercontent.com/u/909990?s=60&v=4"
  };

  new Notification("Found " + new_issues_text(new_issues.length), options);
}

function notify(new_issues) {
  if (new_issues.length == 0)
    return;

  if (Notification.permission === "granted") {
    create_notification(new_issues);
  }
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(function (permission) {
      if (permission === "granted") {
        create_notification(new_issues);
      }
    });
  }
}

function display_counter(num)
{
  if (num == 0)
    return;

  var counter = document.getElementById("new_issues_count");
  counter.textContent = new_issues_text(num);
  counter.classList.remove("hidden");
}

function move_new_page(iframe)
{
  var new_pg = document.querySelectorAll("iframe")[0].contentWindow.document.getElementById("page");

  // remove the iframe and the old page
  document.body.removeChild(iframe);
  document.body.removeChild(document.getElementById("page"));
  // add the new content
  document.body.appendChild(new_pg);
}

var highlighted = [];

function hightlight()
{
  // highlight the new failures
  highlighted.forEach( (id) => {
    var node = document.getElementById(id);

    if (node != null)
      node.className += " highlight";
  });

  display_counter(document.querySelectorAll("tr.highlight").length)
}

function receiveMessage(event)
{
  var iframe = document.querySelectorAll("iframe")[0];
  if (iframe == null || iframe.contentWindow != event.source)
    return;

  console.log("Received message:", event.data);

  var current_ids = failure_ids(document);
  var loaded_ids = failure_ids(iframe.contentWindow.document.body);
  var new_ids = new_items(current_ids, loaded_ids);
  // add to highlighted if not already there
  new_ids.forEach((item) => {
    if (highlighted.indexOf(item) < 0)
      highlighted.push(item);
  });
  console.log("New issues: ", new_ids.length);

  var orig_filter_value = document.getElementById('show_all').checked;
  move_new_page(iframe);
  bind_filter_button();
  hightlight();
  document.getElementById('show_all').checked = orig_filter_value;
  run_display_filter(document.getElementById('show_all').checked);

  // report the new failures via HTML5 notifications
  notify(new_ids);
}

window.addEventListener("message", receiveMessage, false);

function run_display_filter(only_failures)
{
  var style = only_failures ? "none" : "table-row";
  document.querySelectorAll('.success_row').forEach(e => e.style.display = style);
}

function bind_filter_button()
{
  // handle changing the "Filter" check box value
  document.getElementById('show_all').addEventListener('change', (event) => {
    run_display_filter(event.target.checked);
  });
}

window.onload = function() {
  bind_filter_button();

  if (window != window.parent)
  {
    window.parent.postMessage("New document loaded", document.URL);
  }

  // check the new issues every 5 minutes
  window.setInterval(update_page, 5*60*1000);
};
