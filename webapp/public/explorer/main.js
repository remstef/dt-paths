function drawsimilaritytree(query, apiQueryGeneratorFunction, limit, offset, parentelement, callbackStartDrawing, callbackDrawingFinished, startcollapsed=false) {
    var margin = {top: 20, right: 120, bottom: 20, left: 120},
        width = 10000000 - margin.right - margin.left,
        height = 10000000 - margin.top - margin.bottom;

    var i = 0,
        duration = 750,
        root;

    var tree = d3.layout.tree()
        .size([height, width]);

    var diagonal = d3.svg.diagonal()
        .projection(function(d) { return [d.y, d.x]; });

    const apiquery =  apiQueryGeneratorFunction(query, limit, offset);

    var svg = d3.select(parentelement).append("svg:svg")
        .attr("width", width + margin.right + margin.left)
        .attr("height", 10000000)//height + margin.top + margin.bottom)
        .append("svg:g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    callbackStartDrawing();
    d3.json(apiquery, function(error, init) {
      if (error) throw error;
      root = {
        isroot: true,
        name: query,
        similar: !startcollapsed ? transformApiResults(init) : undefined,
        _similar: startcollapsed ? transformApiResults(init) : undefined,
        textview: query,
        x0: height / 2,
        y0: 0
      };
      update(root);
      callbackDrawingFinished();
    });

    d3.select(self.frameElement).style("height", height+"px");

    function update(source) {
    	
      // set the children access
      tree.children(function (d) {
          return d.similar;
      })

      // Compute the new tree layout.
	    // compute the new height
      var levelWidth = [1];
      var childCount = function(level, n) {
        if(n.similar && n.similar.length > 0) {
          if(levelWidth.length <= level + 1) {
            levelWidth.push(1);
          }
          levelWidth[level+1] = (n.similar.length * (level/3 + 1))-1;
          n.similar.forEach(function(d) {
            childCount(level + 1, d);
          });
      	}
	    };
	  childCount(0, root);  
	  var newHeight = d3.max(levelWidth) * 20; // 20 pixels per line  
	  tree = tree.size([newHeight, width]);
    	
      var nodes = tree.nodes(root).reverse(),
          links = tree.links(nodes);

      // Normalize for fixed-depth.
      nodes.forEach(function(d) { d.y = d.depth * 300; });

      // Update the nodes…
      var node = svg.selectAll("g.node")
          .data(nodes, function(d) { return d.id || (d.id = ++i); });

      // Enter any new nodes at the parent's previous position.
      var nodeEnter = node.enter().append("g")
          .attr("class", "node")
          .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
          .on("click", click);

      nodeEnter.append("circle")
          .attr("r", 1e-6)
          .style("fill", function(d) { return  d.expanded || d.query ? "lightsteelblue" : "#fff"; });

      nodeEnter.append("text")
          .attr("x", function(d) { return d.isroot ? -10 : 10; })
          .attr("dy", ".35em")
          .attr("text-anchor", function(d) { return d.isroot ? "end" : "start"; })
          .text(function(d) { return d.textview })
          .style("fill-opacity", 1e-6);

      // Transition nodes to their new position.
      var nodeUpdate = node.transition()
          .duration(duration)
          .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

      nodeUpdate.select("circle")
          .attr("r", 4.5)
          .style("fill", function(d) { return d.expanded || d.query ? "lightsteelblue" : "#fff"; });

      nodeUpdate.select("text")
          .style("fill-opacity", 1);

      // Transition exiting nodes to the parent's new position.
      var nodeExit = node.exit().transition()
          .duration(duration)
          .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
          .remove();

      nodeExit.select("circle")
          .attr("r", 1e-6);

      nodeExit.select("text")
          .style("fill-opacity", 1e-6);

      // Update the links…
      var link = svg.selectAll("path.link")
          .data(links, function(d) { return d.target.id; });

      // Enter any new links at the parent's previous position.
      link.enter().insert("path", "g")
          .attr("class", "link")
          .attr("d", function(d) {
            var o = {x: source.x0, y: source.y0};
            return diagonal({source: o, target: o});
          });

      // Transition links to their new position.
      link.transition()
          .duration(duration)
          .attr("d", diagonal);

      // Transition exiting nodes to the parent's new position.
      link.exit().transition()
          .duration(duration)
          .attr("d", function(d) {
            var o = {x: source.x, y: source.y};
            return diagonal({source: o, target: o});
          })
          .remove();

      // Stash the old positions for transition.
      nodes.forEach(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }

    // Toggle children on click.
    function click(d) {
      if (d.similar) { // blend out
        d._similar = d.similar;
        d.similar = null;
        update(d);
      } else { // blend in
        if (d._similar) { // if data was loaded but is invisible
          d.similar = d._similar;
          d._similar = null;
          update(d);
        } else {
          if(d.textview == "more (...)"){ // load more and attach to d's root
            d.parent.similar.pop(); // remove the 'more' node
            const apiquery = apiQueryGeneratorFunction(d.parent.name, limit, (offset + d.parent.similar.length))
	          callbackStartDrawing();
	          d3.json(apiquery, function(error, more) {
              if (error) throw error;
              d.parent.similar = d.parent.similar.concat(transformApiResults(more));
	            update(d.parent);
	            callbackDrawingFinished();
	          });
          }else{        	  
            // load children
            const apiquery = apiQueryGeneratorFunction(d.name, limit, offset)
	          callbackStartDrawing();
	          d3.json(apiquery, function(error, similar) {
	            if (error) throw error;
	            d.expanded = true;
              d.similar = transformApiResults(similar);
	            update(d);
	            callbackDrawingFinished();
	          });
          }
        }
      }
    }
}

function transformApiResults(resultarray){
  resultarray.forEach(x => x.textview = `(${x.rank}: ${x.weight}) ${x.name}`)
  //  add a node for more      
  resultarray.push({ textview: "more (...)"});
  return resultarray;
}