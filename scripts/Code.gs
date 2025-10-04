var POST_URL = "https://api.github.com/repos/devsgowhere/devsgowhere/dispatches"
function onSubmit(e) {
  var form = FormApp.getActiveForm()
  var allResponses = form.getResponses()
  var latestResponse = allResponses[allResponses.length - 1]
  var response = latestResponse.getItemResponses()
  var payload = {
    event_type: "create_event_webhook",
    client_payload: {},
  }
  for (var i = 0; i < response.length; i++) {
    var question = response[i].getItem().getTitle()
    var answer = response[i].getResponse()
    payload.client_payload[question] = answer
  }

  const scriptProperties = PropertiesService.getScriptProperties()
  const properties = scriptProperties.getProperties()

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: "Bearer " + properties["GH_TOKEN"],
      "X-GitHub-Api-Version": "2022-11-28",
    },
    payload: JSON.stringify(payload),
  }
  UrlFetchApp.fetch(POST_URL, options)
}
