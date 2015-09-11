/* globals Engine, horizSpaceRepeatedObjects, translate */

var Charts = (function() {

	"use strict";

	const DOTS = 110, HEIGHT = 470, DEBUG = 1, VERSION = "0.1.19a";

	/* Define member variables */
	var m_CurrMetric = 1;
	var m_MatchLength;
	var m_Metrics = [
		{ "id": "buildings", "name": "Buildings" },
		{ "id": "units", "name": "Units" },
		{ "id": "food", "name": "Food" },
		{ "id": "wood", "name": "Wood" },
		{ "id": "stone", "name": "Stone" },
		{ "id": "metal", "name": "Metal" },
		{ "id": "explored", "name": "Explored" },
		{ "id": "mapControl", "name": "Territory" },
	];
	var m_Players = [
		{ 'colour': { 'r': 255, 'g': 255, 'b': 255 }, visible: false }, // gaia
		{ 'colour': { 'r':  46, 'g':  46, 'b': 200 }, visible: false }, // blue
		{ 'colour': { 'r': 150, 'g':  20, 'b':  20 }, visible: false }, // red
		{ 'colour': { 'r':  50, 'g': 165, 'b':   5 }, visible: false }, // green
		{ 'colour': { 'r': 230, 'g': 230, 'b':  75 }, visible: false }, // yellow
		{ 'colour': { 'r':  50, 'g': 170, 'b': 170 }, visible: false }, // turquois
		{ 'colour': { 'r': 160, 'g':  80, 'b': 200 }, visible: false }, // pink
		{ 'colour': { 'r': 235, 'g': 120, 'b':  20 }, visible: false }, // orange
		{ 'colour': { 'r':  64, 'g':  64, 'b':  64 }, visible: false }, // gray
	];
	/* ...and a shorthand */
	var $ = Engine.GetGUIObjectByName;

	function deb   () {if (DEBUG > 0){print(fmt.apply(null, arguments));}}
	function tab   (s, l) {l=l||8;s=new Array(l+1).join(" ")+s;return s.substr(s.length-l);}
	function fmt   () {var a=Array.prototype.slice.apply(arguments),s=a[0].split("%s"),p=a.slice(1).concat([""]),c=0;return s.map(function(t){return t + p[c++];}).join('');}

	function getIdxFromName (name) { return +name.substring(name.indexOf("[")+1, name.indexOf("]")); }

	function interpolate(data, points)
	{
		// http://www.hevi.info/2012/03/interpolating-and-array-to-fit-another-size/

		var newData = [];
		var factor  = (data.length - 1) / (points -1);

		function linear(p1, p2, px) {return p1 + (p2 - p1) * px;}

		newData[0] = data[0];
		newData[points -1] = data[data.length -1];

		for (let i=1; i<points-1; ++i){
			let tmp = i * factor;
			let point = ~~tmp;
			newData[i] = linear(data[point], data[point+1], tmp - point);
		}

		return newData;
	}

	function init(dataGame)
	{
		var maxPlayers = dataGame.playerStates.length;
		m_MatchLength = Object.keys(dataGame.playerStates[1].chartData).length - 1;

		deb("init: m_Players: %s, stamps: %s\n", maxPlayers -1, m_MatchLength);

		// add common attributes to m_Metrics object
		for (let m of m_Metrics)
		{
			m.points =  {};
			m.min = 1e10;
			m.max = 0;
		}

		// setup menu options
		horizSpaceRepeatedObjects("chartMenu[m]", "m");
		var m = 0;
		for (m in m_Metrics)
			$("chartMenu["+m+"]_text").caption = translate(m_Metrics[m].name);
		hideRemaining("chartMenu[", ++m, "]");

		// setup players' dots
		horizSpaceRepeatedObjects("chartPlayer[p]", "p");
		for (let p=0; p<8; ++p)
		{
			// player dots
			$("chartPlayerDot[" + p + "]").sprite = "chartDotP" + (p+1);
			$("chartPlayerText[" + p + "]").caption = (p+1);

			// data dots
			horizSpaceRepeatedObjects("chartDot[" + p + "][d]", "d");
			for (let d=0;; ++d)
			{
				let objObj = $("chartDot[" + p + "][" + d + "]");
				if (!objObj)
					break;
				objObj.sprite = "chartDotP"+(p+1);
				objObj.hidden = "true";
			}
		}

		// resample data to available amount of DOTS
		for (let p=1; p<maxPlayers; ++p)
		{
			m_Players[p].visible = true;
			for (let metricData of m_Metrics)
			{
				let chartData = dataGame.playerStates[p].chartData;
				let data = Object.keys(chartData).map(stamp => chartData[stamp][metricData.id]);
				// deb("init: p: %s, m: %s, data: %s\n", p, m, data);
				metricData.points[p] = {};
				data = interpolate(data, DOTS);
				// deb("init: p: %s, m: %s, data: %s\n", p, m, data);
				metricData.points[p] = data;
			}
		}

		// determine max/min
		for (let metricData of m_Metrics)
		{

			let maxAll = metricData.max;
			let minAll = metricData.min;
			for (let p=1; p<maxPlayers; p++)
			{
				let minData = Math.min.apply(Math, metricData.points[p]);
				minAll = minData < minAll ? minData : minAll;
				let maxData = Math.max.apply(Math, metricData.points[p]);
				maxAll = maxData > maxAll ? maxData : maxAll;
			}
			metricData.max = maxAll;
			metricData.min = minAll;
			deb("init: min: %s, max: %s, metric: %s\n", tab(~~minAll, 4), tab(~~maxAll, 6), metricData.id);
		}

		// scale data to GUI
		for (let metricData of m_Metrics)
			for (let p=1; p<maxPlayers; p++)
				for (let d=0; d<DOTS; d++)
					metricData.points[p][d] = HEIGHT * metricData.points[p][d] / metricData.max;
	}

	function togglePlayer(player)
	{
		var sprite = $("chartPlayerDot[" + (player-1) +"]");

		m_Players[player].visible = !m_Players[player].visible;
		sprite.sprite = m_Players[player].visible ? "chartDotP" + player : "chartDotP0";
		showMetric(m_CurrMetric);
	}

	function showTicks()
	{
		var metric = m_Metrics[m_CurrMetric].id;
		var ySuffix = (["explored", "mapControl"].indexOf(metric) > -1) ? "%" : "";

		$("chartTickTextYMax").caption  = ~~m_Metrics[m_CurrMetric].max + ySuffix;
		$("chartTickTextYHalf").caption = ~~(m_Metrics[m_CurrMetric].max / 2) + ySuffix;
		$("chartTickTextXMax").caption  = m_MatchLength + " min";
		$("chartTickTextXHalf").caption = ~~(m_MatchLength / 2) + " min";
	}

	function showMetric(metric)
	{
		m_CurrMetric = metric;

		// highlight current metric's text
		for (let m in m_Metrics)
			$("chartMenu["+m+"]_text").textcolor = "180 180 180";
		$("chartMenu["+metric+"]_text").textcolor = "255 255 255";

		deb("\n====> showMetric: %s (%s), min: %s, max: %s\n", m_Metrics[metric].id, metric, m_Metrics[metric].min, m_Metrics[metric].max);

		for (let p in m_Players)
		{
			if (+p === 0)
				continue;

			let player = m_Players[p];

			// player dots
			$("chartPlayer[" + (p-1) + "]").hidden = !m_Metrics[metric].points[p];

			// data dots
			if (m_Metrics[metric].points[p])
			{
				let data = m_Metrics[metric].points[p];
				if (DEBUG)
				{
					let min  = +Math.min.apply(Math, data);
					let max  = +Math.max.apply(Math, data);
					deb("p: %s, vis: %s, len: %s, min: %s, max: %s\n", p, player.visible, data.length, min, max);
				}

				for (let i = 0; i < DOTS; i++)
				{
					let dot = $("chartDot[" +(p-1)+ "][" +i+ "]");
					dot.hidden = true;

					if (player.visible)
					{
						let newSize = dot.size;
						newSize.top = HEIGHT - data[i];
						newSize.bottom = newSize.top + 8;
						dot.size = newSize;
						dot.hidden = false;
					}
				}
			}
		}

		showTicks();
	}  

	return {
		action: function(metric, player, data) {

			deb("\n====> Charts.action: %s, %s, %s\n", metric, player, data);

			if (!metric && !player){init(data); showMetric(0); return;}
			if ( metric && !player){showMetric(metric -1);     return;}
			if (!metric &&  player){togglePlayer(player);      return;}

		},
		"togglePlayer": function(elem_name)
		{
			if (!elem_name)
				return;
			togglePlayer(getIdxFromName(elem_name)+1);
		},
		"changeMetric": function(elem_name)
		{
			if (!elem_name)
				return;
			showMetric(getIdxFromName(elem_name));
		}
	};

}());

