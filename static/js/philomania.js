class MovingSprite {
    constructor(index, color, name) {
        this.index = index;
        this.isMoving = false;
        this.imageUrl = '';
        this.color = color;
        this.name = name;
        this.element = '';
        this.init();
    }

    init() {
        console.log(`${this.name} init()`);
        this.generateHtml();
    }

    deinit() {
        console.log(`${this.name} deinit()`);
    }

    generateHtml() {
        console.log(`${this.name} generateHtml()`);
        var containerDiv = document.createElement('div');
        containerDiv.className = 'moving-sprite';
        containerDiv.setAttribute('id', this.name);
        containerDiv.setAttribute('index', this.index);
        containerDiv.style.backgroundColor = this.color;
        document.body.appendChild(containerDiv);

        this.element = document.getElementById(this.name);
        this.element.addEventListener('transitionend', function(e) {
            var denchHead = philomania.getDenchHeadFromEvent(e);
            denchHead.isMoving = false;
        });
    }

    move() {
        if (!this.isMoving) {
            console.log(`${this.name} move()`);
            this.isMoving = true;
            let windowHeight = window.innerHeight;
            let windowWidth = window.innerWidth;
            let elementWidth = this.element.offsetWidth;
            let elementHeight = this.element.offsetHeight;
            let newX = randomIntFromInterval(0, windowWidth - elementWidth);
            let newY = randomIntFromInterval(0, windowHeight - elementHeight);

            let transitionTime = randomIntFromInterval(300, 8000);
            this.element.style.transition = transitionTime + 'ms';
            this.element.style.top = newY + 'px';
            this.element.style.left = newX + 'px';
        }
    }
}

var philomania = {
    'philHead'          : undefined,
    'numDenchHeads'     : 2,
    'denchHeads'        : [],
    'eventLoopMs'       : 500,
    'eventLoopTimer'    : undefined
};

philomania.init = function() {
    philomania.generatePhilHead();
    philomania.generateDenchHeads();
    philomania.startGameLoop();
};

philomania.generatePhilHead = function() {
    console.log('philomania.generatePhilHead()');
    philomania.philHead = new MovingSprite(0, 'blue', 'phil_head', true);

    document.addEventListener('mousemove', function(e) {
        philomania.philHead.element.style.left = e.clientX + 'px';
        philomania.philHead.element.style.top = e.clientY + 'px';

        // Detect collisions while moving cursor
        for (var i in philomania.denchHeads) {
            let head = philomania.denchHeads[i];
            if (detectCollision(head.element, philomania.philHead.element)) {
                philomania.collisionDetected();
                break;
            }
        }
    });
};

philomania.generateDenchHeads = function() {
    console.log('philomania.generateDenchHeads()');
    for (var i in philomania.denchHeads) {
        let head = philomania.denchHeads[i];
        head.deinit();
    }

    for (var j=0; j<philomania.numDenchHeads; j++) {
        var denchHead = new MovingSprite(j, 'red', `dench_head_${j}`, true);
        philomania.denchHeads.push(denchHead);
    }
};

philomania.startGameLoop = function() {
    console.log('philomania.startGameLoop()');
    philomania.eventLoopTimer = setInterval(function() {
        // Main game loop
        for (var i in philomania.denchHeads) {
            let head = philomania.denchHeads[i];
            // Move Dench Heads
            head.move();

            // Detect collisions
            if (detectCollision(head.element, philomania.philHead.element)) {
                philomania.collisionDetected();
                break;
            }
        }
    }, philomania.eventLoopMs);
};

philomania.collisionDetected = function() {
    console.log(`Collision with phil!`);
};

// Utility functions
philomania.getDenchHeadFromEvent = function(event) {
    var headIndex = event.target.getAttribute('index');
    return philomania.denchHeads[headIndex];
};