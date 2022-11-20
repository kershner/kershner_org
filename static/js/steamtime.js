// STEAMTIME.JS
//  This is ancient code from ~2014.  I like the project and want it to remain accessible so I've put the bare
//  minimum effort in to clean it up and port it to this Django project.
//  Original code here: https://github.com/kershner/steamtime

// Calls functions for the /home page
function steamtime() {
	messageExists();
	showForm();
	showAbout();
	showFindID();
	closeFindID();
	closeAbout();
	loading();
	dontHave();
}

// Calls functions for the /results page
function steamtimeResults(data_array, privacy) {
	resultsFadeIn(privacy);
	showSearch();
	asterisk();
	hallOfShame();
	hiddenMenu();
	smoothTop();
	showLegend();
	getFriendId();
	showFriends();
	tabSelect();
	optionsSelect();
	tooltips();
	logoGlow();
	if (privacy === undefined) {
		initialSelections(data_array);		
	}
	else { 
		initialSelectionsPrivacy(data_array);
	}
	rangeSelection(data_array);
}

// Displays tooltips on hover
function tooltips() {
	$("#list-selector").hover(function(){
		timer = setTimeout(function() {
			$("#list-tip").fadeIn("fast");
		}, 800);		
	}, function () {
		clearTimeout(timer);
		$("#list-tip").fadeOut("fast");		
	});
	$("#donut-selector").hover(function(){
		timer = setTimeout(function() {
			$("#donut-tip").fadeIn("fast");
		}, 800);		
	}, function () {
		clearTimeout(timer);
		$("#donut-tip").fadeOut("fast");		
	});
	$("#bar-selector").hover(function(){
		timer = setTimeout(function() {
			$("#bar-tip").fadeIn("fast");
		}, 800);		
	}, function () {
		clearTimeout(timer);
		$("#bar-tip").fadeOut("fast");		
	});
}

// Hover effect for logo on results page
function logoGlow() {
	$("#header").hover(function() {
		$("#results-big-logo").addClass("text-glow");
	}, function() {
		$("#results-big-logo").removeClass("text-glow");
	});
}

// Controls the initial animation for the /home page
function initialFadeIn() {
	$("#footer").css("display", "none");
	setTimeout(function() {
		$("#welcome-header").fadeIn("fast");
	}, 100);
	setTimeout(function() {
		$("#big-logo").fadeIn("fast");
	}, 500);
	setTimeout(function() {
		$("#slogan").fadeIn("fast");
	}, 1000);
	setTimeout(function() {
		$("#buttons").fadeIn("fast");
		$("#footer").fadeIn("fast");
	}, 1600);
}

// Determines initial content/readout for users with privacy settings
function resultsFadeIn(privacy) {
	setTimeout(function() {
		$("#header").fadeIn("fast");
	}, 200);
	setTimeout(function() {
		$("#user-info").fadeIn("fast");
		$(".result-template").fadeIn("fast");
		$("#search-select").fadeIn("fast");
		if (privacy === undefined) {
			displayElements("#readout_2weeks", "#list_2weeks");
		}
		else {
			displayElements("#readout_10", "#list_10");
		}
	}, 400);
}

// These functions determine what the graph icons initially display when clicked
function initialSelections(data_array) {
	$("#list-selector").click(function() {
		showList_2weeks();
	});
	$("#line-selector").click(function() {
		showLine_2weeks(data_array[3]);
	});
	$("#donut-selector").click(function() {
		showDonut_2weeks(data_array[0]);
	});
	$("#bar-selector").click(function() {
		showBar_2weeks(data_array[6]);
	});
}

function initialSelectionsPrivacy(data_array) {
	$("#list-selector").click(function() {
		showList_10();
	});
	$("#line-selector").click(function() {
		showLine_10(data_array[4]);
	});
	$("#donut-selector").click(function() {
		showDonut_10(data_array[1]);
	});
	$("#bar-selector").click(function() {
		showBar_10(data_array[7]);
	});
	setTimeout(function() {
		$(".result-template").fadeIn("fast");
		$("#data_10").fadeIn("fast");
	}, 400);	
}

// Add a little extra margin if there is an error message on the home page
function messageExists() {
	if ($(".message").length > 0) {
		$("#welcome-header, #big-logo, #slogan, #buttons, #footer, #form").fadeIn("fast");		
		$("#welcome-header").css("margin-top", "25px");
		$("#about-content").css("top", "25px");
	} else {
		initialFadeIn();
	};
}

// Fades in a hidden menu div once scrolled past a certain position
function hiddenMenu() {
	$(window).scroll(function() {
		if ($(window).scrollTop() > 315) {
			$("#hidden-menu").fadeIn("fast").css("display", "block");
		}
		else if ($(window).scrollTop() < 316) {
			$("#hidden-menu").fadeOut("fast");
		}
	});
}

// Smoothly return to top of page once icon is clicked
function smoothTop() {
	$("#top").click(function() {
		$("html, body").animate({ scrollTop: 0 }, "slow");
	});
}

// These functions fade in elements based on buttons being clicked
function showForm() {
	if (!$(".message").length > 0) {
		$("#get-started").one("click", function() {
			$("#welcome-header").animate({
				"height" : "590px",
				"margin-top" : "100px",
				"padding-bottom" : "5px"
				}, 450, function() {
					$("#form").fadeIn("slow", "linear");
				});
			$("#about-content").css("top", "25px");
		});
	}
}

function showAbout() {
	$("#about").click(function() {
		$("#about-content").draggable();
		$("#about-content").fadeIn("fast");
		$("#about-wrapper").fadeIn("fast");
	});
}

function closeAbout() {
	$("#close").click(function() {
		$("#about-content").fadeOut("fast");
		$("#about-wrapper").fadeOut("fast");
	});
	$("#about-wrapper").click(function() {
		$("#about-content").fadeOut("fast");
		$("#about-wrapper").fadeOut("fast");
	});
}

function showFindID() {
	$("#where").click(function() {
		$("#find-id").fadeIn("fast");
		$("#find-id").draggable();
	});
}

function closeFindID() {
	$("#find-close").click(function() {
		$("#find-id").fadeOut("fast");
	});
}

function dontHave() {
	$("#dont").click(function() {
		$("#steamid").val("billcrystals");
		$("#use-mine").fadeIn(450);
	});
}

function showSearch() {
	$("#search-select").click(function() {
		$("#search-select").animate({"margin-bottom" : "15px"}, 100, function () {
			$("#new-search").fadeIn("slow");
		});		
	});
}

function showLegend() {
	$(".legend-toggle").click(function() {
		$(".legend, #split").fadeToggle("slow");	
		$(".legend, #split").draggable();		
	});
}

function asterisk() {
	$(".asterisk").click(function() {		
		$("#asterisk-explanation").fadeIn("fast");
		$("#asterisk-explanation").draggable();
	});
	$("#asterisk-close").click(function() {
		$("#asterisk-explanation").fadeOut("fast");
	});
}

// Controls fading in of the loading/privacy notification
function dimmer() {
	$("#loading-dimmer").fadeIn("slow");
	$("#loading").draggable();
	setTimeout(function() {
		$("#loading").animate({height : "200px"}, 500);
		$("#text1").fadeIn("slow");
	}, 6000);
	setTimeout(function() {
		$("#text1").fadeOut(1);
		$("#text2").fadeIn("slow");
	}, 18000);
}

function loading() {
	let form = document.getElementsByTagName('form')[0];
	form.addEventListener('submit', function() {
		dimmer();
	})
}

function privacyNotice() {
	setTimeout(function() {
		$("#privacy-dimmer").fadeIn("fast");
		$("#privacy-alert").draggable();
	}, 200);
	closePrivacyNotice();
}

function closePrivacyNotice() {
	$("#close-privacy").click(function() {
		$("#privacy-dimmer").fadeOut("fast");
	});
}

// Grabs SteamID (via alt attribute) for selected friend and submits to a hidden form
function getFriendId() {
	$(".friends").click(function () {
		var alt = $(this).children(":first").attr("alt");
		$("#steamid").val(alt);
		$("form").submit();
		dimmer();
	});
}

// Controls what the range selections in the .result-template div display
function rangeSelection(data_array) {
	$(".select_donut_2weeks").click(function (){
		showDonut_2weeks(data_array[0]);
	});
	$(".select_donut_10").click(function (){
		showDonut_10(data_array[1]);
	});
	$(".select_donut_20").click(function (){
		showDonut_20(data_array[2]);
	});
	$(".select_line_2weeks").click(function (){
		showLine_2weeks(data_array[3]);
	});
	$(".select_line_10").click(function (){
		showLine_10(data_array[4]);
	});
	$(".select_line_20").click(function (){
		showLine_20(data_array[5]);
	});
	$(".select_bar_2weeks").click(function (){
		showBar_2weeks(data_array[6]);
	});
	$(".select_bar_10").click(function (){
		showBar_10(data_array[7]);
	});
	$(".select_bar_20").click(function (){
		showBar_20(data_array[8]);
	});	
	$(".select_data_2weeks").click(function (){
		showList_2weeks();
	});
	$(".select_data_10").click(function (){
		showList_10();
	});
	$(".select_data_20").click(function (){
		showList_20();
	});
	$(".select_data_all").click(function (){
		showList_all();
	});	
}

// Displays Stats div/renders charts
function showStats(data1, data2, breakdownData) {
	$("#stats-tab").click(function() {
		displayElements("#readout-stats", "#stats");
		var masonry = new Masonry("#distinctions-grid", {
				itemSelector: ".distinction"
            });
		options = {animationSteps: 70, animationEasing: "easeOutExpo"};
		options2 = {scaleFontColor: "#FFFFFF", scaleGridLineColor : "#FFFFFF"};
		var ctx1 = $("#canvas-gen_stat_charts1").get(0).getContext("2d");
		var ctx2 = $("#canvas-gen_stat_charts2").get(0).getContext("2d");
		var ctx3 = $("#canvas-breakdown_chart").get(0).getContext("2d");
		var myPieChart1 = new Chart(ctx1).Pie(data1, options);
		var myPieChart2 = new Chart(ctx2).Pie(data2, options);
		var myPieChart3 = new Chart(ctx3).Bar(breakdownData, options2);
	});
}

// Displays Hall of Shame div
function hallOfShame() {
	$("#shame-tab").click(function() {
		displayElements("#hall-of-shame-content", "#readout-shame");
	});
}

// Displays Friends div
function showFriends() {
	$("#friends-tab").click(function() {
		displayElements("#readout-friends", "#friends");
	});
}

// Function to determine which content/readout divs to display
function displayElements(fade1, fade2) {
    var elements = [
	"#donut_2weeks", "#donut_10", "#donut_20", "#bar_2weeks",
	"#bar_10", "#bar_20", "#line_2weeks", "#line_10", "#line_20",
	"#list_2weeks", "#list_10", "#list_20", "#readout_10", "#readout_20",
	"#readout_2weeks", "#list_all", "#readout_all", "#readout-friends",
	"#readout-shame", "#hall-of-shame-content", "#friends", "#readout-stats",
	"#stats"
];
    for (i = 0; i < elements.length; i++) {
        if (elements[i] === fade1 || elements[i] === fade2) {
            elements.splice(i, 1);
        }
    }
	
	for (i = 0; i < elements.length; i++) {
		$(elements[i]).css("display", "none");
	}

	console.log(fade1);
	console.log(fade2);
	
	$(fade1).fadeIn("slow");
	$(fade2).fadeIn("slow");
}

// These functions call displayElements based on what icon/range has been clicked
function showDonut_2weeks(data) {
	displayElements("#readout_2weeks", "#donut_2weeks");
	options = {animationSteps: 70, animationEasing: "easeOutExpo"};
	var ctx = $("#canvas-donut_2weeks").get(0).getContext("2d");
	var myDoughnutChart = new Chart(ctx).Doughnut(data, options);
}

function showDonut_10(data) {
	displayElements("#readout_10", "#donut_10");
	options = {animationSteps: 70, animationEasing: "easeOutExpo"};
	var ctx = $("#canvas-donut_10").get(0).getContext("2d");
	var myDoughnutChart = new Chart(ctx).Doughnut(data, options);
}

function showDonut_20(data) {
	displayElements("#readout_20", "#donut_20");
	options = {animationSteps: 70, animationEasing: "easeOutExpo"};
	var ctx = $("#canvas-donut_20").get(0).getContext("2d");
	var myDoughnutChart = new Chart(ctx).Doughnut(data, options);
}

function showLine_2weeks(data) {
	displayElements("#readout_2weeks", "#line_2weeks");
	options = {scaleFontColor: "#FFFFFF"};
	var ctx = $("#canvas-line-chart_2weeks").get(0).getContext("2d");
	var myDoughnutChart = new Chart(ctx).Line(data, options);
}

function showLine_10(data) {
	displayElements("#readout_10", "#line_10");
	options = {scaleFontColor: "#FFFFFF"};
	var ctx = $("#canvas-line-chart_10").get(0).getContext("2d");
	var myDoughnutChart = new Chart(ctx).Line(data, options);
}

function showLine_20(data) {
	displayElements("#readout_20", "#line_20");
	options = {scaleFontColor: "#FFFFFF"};
	var ctx = $("#canvas-line-chart_20").get(0).getContext("2d");
	var myDoughnutChart = new Chart(ctx).Line(data, options);
}

function showBar_2weeks(data) {
	displayElements("#readout_2weeks", "#bar_2weeks");
	options = {scaleFontColor: "#FFFFFF", scaleGridLineColor : "#FFFFFF"};
	var ctx = $("#canvas-bar-chart_2weeks").get(0).getContext("2d");
	var myDoughnutChart = new Chart(ctx).Bar(data, options);
}

function showBar_10(data) {
	console.log('Bar Data', data);
	displayElements("#readout_10", "#bar_10");
	options = {scaleFontColor: "#FFFFFF", scaleGridLineColor : "#FFFFFF"};
	var ctx = $("#canvas-bar-chart_10").get(0).getContext("2d");
	var myDoughnutChart = new Chart(ctx).Bar(data, options);
}

function showBar_20(data) {
	displayElements("#readout_20", "#bar_20");
	options = {scaleFontColor: "#FFFFFF", scaleGridLineColor : "#FFFFFF"};
	var ctx = $("#canvas-bar-chart_20").get(0).getContext("2d");
	var myDoughnutChart = new Chart(ctx).Bar(data, options);
}

function showList_2weeks() {
	displayElements("#readout_2weeks", "#list_2weeks");
}

function showList_10() {
	displayElements("#readout_10", "#list_10");
}

function showList_20() {
	displayElements("#readout_20", "#list_20");
}

function showList_all() {
	displayElements("#readout_all", "#list_all");
}

// These functions add a 'selected' class to icons that have been clicked
function tabSelect() {
	$("#stats-tab").click(function() {
		$(this).addClass("tab-selected");
		$("#friends-tab").removeClass("tab-selected");
		$("#shame-tab").removeClass("tab-selected");
		$("#list-selector").removeClass("options-selected");
		$("#bar-selector").removeClass("options-selected");
		$("#donut-selector").removeClass("options-selected");
	});
	$("#friends-tab").click(function() {
		$(this).addClass("tab-selected");
		$("#stats-tab").removeClass("tab-selected");
		$("#shame-tab").removeClass("tab-selected");
		$("#bar-selector").removeClass("options-selected");
		$("#list-selector").removeClass("options-selected");
		$("#donut-selector").removeClass("options-selected");
	});
	$("#shame-tab").click(function() {
		$(this).addClass("tab-selected");
		$("#stats-tab").removeClass("tab-selected");
		$("#friends-tab").removeClass("tab-selected");
		$("#bar-selector").removeClass("options-selected");
		$("#list-selector").removeClass("options-selected");
		$("#donut-selector").removeClass("options-selected");
	});
}

function optionsSelect() {
	$("#list-selector").click(function() {
		$(this).addClass("options-selected");
		$("#donut-selector").removeClass("options-selected");
		$("#bar-selector").removeClass("options-selected");
		$("#stats-tab").removeClass("tab-selected");
		$("#friends-tab").removeClass("tab-selected");
		$("#shame-tab").removeClass("tab-selected");
	});
	$("#donut-selector").click(function() {
		$(this).addClass("options-selected");
		$("#list-selector").removeClass("options-selected");
		$("#bar-selector").removeClass("options-selected");
		$("#stats-tab").removeClass("tab-selected");
		$("#friends-tab").removeClass("tab-selected");
		$("#shame-tab").removeClass("tab-selected");
	});
	$("#bar-selector").click(function() {
		$(this).addClass("options-selected");
		$("#donut-selector").removeClass("options-selected");
		$("#list-selector").removeClass("options-selected");
		$("#stats-tab").removeClass("tab-selected");
		$("#friends-tab").removeClass("tab-selected");
		$("#shame-tab").removeClass("tab-selected");
	});
}