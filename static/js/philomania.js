class MovingSprite {
    constructor(index, type) {
        this.index = index;
        this.type = type;
        this.isMoving = false;
        this.color = '';
        this.imageUrl = '';
        this.name = `${type}_${index}`;
        this.element = '';

        this.initialX = 0;
        this.initialY = 0;
        this.init();
    }

    init() {
        console.log(`${this.name} init()`);

        switch (this.type) {
            case 'dench_head':
                this.color = 'red';
                this.initialX = window.innerWidth;
                this.initialY = window.innerHeight;
                break;
            case 'phil_head':
                this.color = 'blue';
                break;
        }

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
        containerDiv.style.top = this.initialY - 100 + 'px';
        containerDiv.style.left = this.initialX - 100 + 'px';
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
    philomania.philHead = new MovingSprite(0, 'phil_head');

    document.addEventListener('mousemove', function(e) {
        philomania.philHead.element.style.left = e.clientX + 'px';
        philomania.philHead.element.style.top = e.clientY + 'px';

        // Detect collisions while moving cursor
        for (var i in philomania.denchHeads) {
            let head = philomania.denchHeads[i];
            if (detectCollision(head.element, philomania.philHead.element)) {
                philomania.collisionDetected(head);
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
        var denchHead = new MovingSprite(j, 'dench_head');
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
                philomania.collisionDetected(head);
                break;
            }
        }
    }, philomania.eventLoopMs);
};

philomania.collisionDetected = function(denchHead) {
    console.log(`${denchHead.name} has collided with phil!`);
    denchHead.element.style.transition = '100ms';
    denchHead.element.style.transform = 'scale(1.5)';
    setTimeout(function() {
        denchHead.element.style.transform = 'scale(1)';
    }, 150);
};

// Utility functions
philomania.getDenchHeadFromEvent = function(event) {
    var headIndex = event.target.getAttribute('index');
    return philomania.denchHeads[headIndex];
};