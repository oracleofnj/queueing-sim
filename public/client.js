// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

function generateNextArrival(t, poisTime, maxTime, eventQueue) {
  let nextArrival = t + randomExponential(1.0/poisTime);
  if (nextArrival < maxTime) {
    eventQueue.queue({eventTime: nextArrival, eventType: "patientArrival"});
  }
}

function runClinicOnce(numDoctors, minDocTime, maxDocTime, poisTime) {
  const clinicOpen = 9*60, clinicClose = 16*60;
  let eventQueue = new PriorityQueue({
    comparator: function(a,b) {return a.eventTime-b.eventTime;},
    initialValues: [{eventTime: clinicOpen, eventType: "clinicOpen"}]
  });
  let docAvailable = [], i=0, noDocs = false, closeTime = clinicClose, numPatients = 0, waits = [];
  let patientQueue = new Queue(), orderedEvents = [];
  for (i = 0; i < numDoctors; i++) {
    docAvailable[i] = true;
  }
  while (eventQueue.length > 0) {
    var item = eventQueue.dequeue();
    orderedEvents.push(item);
    switch(item.eventType) {
      case "clinicOpen":
        generateNextArrival(item.eventTime, poisTime, clinicClose, eventQueue);
        break;
      case "patientArrival":
        generateNextArrival(item.eventTime, poisTime, clinicClose, eventQueue);
        noDocs = true;
        numPatients++;
        for (i = 0; i < numDoctors; i++) {
          if (docAvailable[i]) {
            eventQueue.queue({
              eventTime: item.eventTime, 
              eventType: "seeDoctor", 
              docNum: i,
              arrivalTime: item.eventTime
            });
            noDocs = false;
            break;
          }
        }
        if (noDocs) {
          eventQueue.queue({
            eventTime: item.eventTime, 
            eventType: "getInLine"
          });
        }
        break;
      case "seeDoctor": 
        docAvailable[item.docNum] = false;
        eventQueue.queue({
          eventTime: item.eventTime + minDocTime + (maxDocTime - minDocTime) * Math.random(),
          eventType: "docFinish",
          docNum: item.docNum
        });
        break;
      case "docFinish":
        docAvailable[item.docNum] = true;
        if (item.eventTime > closeTime) {
          closeTime = item.eventTime;
        }
        if (!patientQueue.isEmpty()) {
          let arrivedAt = patientQueue.dequeue();
          waits.push(item.eventTime - arrivedAt);
          eventQueue.queue({
              eventTime: item.eventTime, 
              eventType: "seeDoctor", 
              docNum: item.docNum,
              arrivalTime: arrivedAt
          })
        }
        break;
      case "getInLine":
        patientQueue.enqueue(item.eventTime);
        break;
      default:
        console.log("Invalid item type");
        break;
    }
  }
  return {
    events: orderedEvents,
    numPatients: numPatients,
    numWaits: waits.length,
    avgWait: waits.length !== 0 ? waits.reduce(function(a,b) {return a+b;}, 0)/waits.length : 0,
    maxWait: waits.reduce(function(a,b) {return a > b ? a : b}, 0),
    minsLate: closeTime - clinicClose
  };
}

function runClinic() {
  let 
    numDocs = Math.trunc(parseFloat($("#numDocs").val())),
    poisTime = parseFloat($("#poisTime").val()),
    minDocTime = parseFloat($("#minDocTime").val()),    
    maxDocTime = parseFloat($("#maxDocTime").val()),    
    numSims = Math.trunc(parseFloat($("#numSims").val()));
  let i = 0, sims = [];
  for (i = 0; i < numSims; i++) {
    sims.push(runClinicOnce(numDocs, minDocTime, maxDocTime, poisTime));
  }
  return sims;
}

function graphResults() {
  // adapted from http://bl.ocks.org/phoebebright/3061203 and http://bl.ocks.org/mbostock/3048450
  
  var formatCount = d3.format(",.0f");
  var numTicks = 25;
  
  var results = d3.select("#simResults").datum();
  var svg = d3.select("#resultGraph");
  var elem = svg.datum();
  if (!elem) {
    elem = Object.keys(results["names"])[0];
    svg.datum(elem);
  }
  var data = results["data"].map(function(x) {return x[elem];});
  var graphTitle = results["names"][elem];
  d3.select("#resultGraph").selectAll("*").remove();
  var svg = d3.select("#resultGraph");
  svg.selectAll("*").remove();
  var
      margin = {top: 10, right: 30, bottom: 30, left: 30},
      width = +svg.attr("width") - margin.left - margin.right,
      height = +svg.attr("height") - margin.top - margin.bottom,
      padding = 100;
      g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var x = d3.scaleLinear()
      .domain(d3.extent(data))
      .rangeRound([padding, width - padding]);

  var bins = d3.histogram()
      .domain(x.domain())
      .thresholds(x.ticks(numTicks))
      (data);
  var y = d3.scaleLinear()
      .domain([0, d3.max(bins, function(d) { return d.length; })])
      .range([height - padding, padding]);
  
  var bar = g.selectAll(".bar")
    .data(bins)
    .enter().append("g")
      .attr("class", "bar")
      .attr("transform", function(d) { return "translate(" + x(d.x0) + "," + y(d.length) + ")"; });

  bar.append("rect")
      .attr("x", 1)
      .attr("width", x(bins[0].x1) - x(bins[0].x0) - 1)
      .attr("height", function(d) { return height - padding - y(d.length); });

  bar.append("text")
      .attr("dy", ".75em")
      .attr("y", 6)
      .attr("x", (x(bins[0].x1) - x(bins[0].x0)) / 2)
      .attr("text-anchor", "middle")
      .text(function(d) { return formatCount(d.length); });

  g.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + (height - padding) + ")")
      .call(d3.axisBottom(x).ticks(numTicks));  
  
  g.append("g")
      .attr("class","axis")
      .attr("transform", "translate(" + padding + ",0)")
      .call(d3.axisLeft(y));
  
  svg.selectAll(".xaxis text")
    .attr("transform", function(d) {
       return "translate(" + this.getBBox().height*-2 + "," + this.getBBox().height + ")rotate(-45)";
   });

  svg.append("text")
      .attr("text-anchor", "middle")  
      .attr("transform", "translate("+ (padding/2) +","+(height/2)+")rotate(-90)") 
      .text("Number of Simulations");

  svg.append("text")
      .attr("text-anchor", "middle") 
      .attr("transform", "translate("+ (width/2) +","+(height-(padding/3))+")")  
      .text(results["names"][elem]);
}

function displayResults() {
  function prettyPrint(n) {
    return Number.isInteger(n) ? n : n.toFixed(4);
  }
  let res = runClinic();
  const toSummarize = {
    numPatients: "Total number of patients",
    numWaits: "Number of patients who had to wait",
    avgWait: "Average time for those who had to wait",
    maxWait: "Maximum wait time",
    minsLate: "Minutes past 4PM clinic closed"
  }
  const summaryBools = [
    {desc: "No patient had to wait", predicateFn: function(x) {return x.numWaits === 0 ? 1 : 0;}},
    {desc: "Clinic closed on time", predicateFn: function(x) {return x.minsLate === 0 ? 1 : 0;}},
    {desc: "Clinic closed after 4:30", predicateFn: function(x) {return x.minsLate > 30 ? 1 : 0;}},
  ];
  let simResults = d3.select("#simResults");
  simResults.selectAll(".simRow").remove();
  simResults.datum({data: res, names: toSummarize});
  let simPercentiles = simResults.select("#simPercentiles");
  let p25 = Math.trunc(0.25 * res.length), p50 = Math.trunc(0.5 * res.length), p75 = Math.trunc(0.75 * res.length);
  Object.keys(toSummarize).map(function(elem) {
    let sortedValues = res.map(function(x) {return x[elem];}).sort(function(x,y) {return x - y;});
    let simRow = simPercentiles.append("div").attr("class","row simRow");
    let header = simRow.append("div").attr("class","col-sm-4").append("a").text(toSummarize[elem]).style("cursor","pointer");
    header.datum(elem).on("click", function() {
      d3.select("#resultGraph").datum(elem);
      graphResults();
    });
    simRow.append("div").attr("class","col-sm-2").text(prettyPrint(sortedValues[p25]));
    simRow.append("div").attr("class","col-sm-2").text(prettyPrint(sortedValues[p50]));
    simRow.append("div").attr("class","col-sm-2").text(prettyPrint(sortedValues[p75]));
    simRow.append("div").attr("class","col-sm-2").text(prettyPrint(d3.sum(sortedValues)/sortedValues.length));
  });
  let simFrequencies = simResults.select("#simFrequencies");
  summaryBools.map(function(p) {
    let eventCount = d3.sum(res.map(p.predicateFn));
    let simRow = simFrequencies.append("div").attr("class","row simRow");
    simRow.append("div").attr("class","col-sm-4").text(p.desc);
    simRow.append("div").attr("class","col-sm-2").text(prettyPrint(eventCount));
    simRow.append("div").attr("class","col-sm-2").text(prettyPrint(eventCount / res.length));
  });
  
  graphResults();
}

$(function() {
  displayResults();
  $("#simulationParams input").change(displayResults);
});
