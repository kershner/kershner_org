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
            console.log('transitionend');
            var headIndex = e.target.getAttribute('index');
            philomania.denchHeads[headIndex].isMoving = false;
        });
    }

    move() {
        console.log(`${this.name} move()`);
        console.log(`this.isMoving: ${this.isMoving}`);

        if (!this.isMoving) {
            this.isMoving = true;
            let windowHeight = window.innerHeight;
            let windowWidth = window.innerWidth;
            let elementWidth = this.element.offsetWidth;
            let elementHeight = this.element.offsetHeight;
            let newX = this.rand((windowWidth - elementWidth));
            let newY = this.rand((windowHeight - elementHeight));

            let transitionTime = this.rand(100) + 1200;
            this.element.style.transition = transitionTime + 'ms';

            this.element.style.top = newY + 'px';
            this.element.style.left = newX + 'px';
            console.log(`newY: ${newY} | newX: ${newX}`);
        }
    }

    rand = (multi) => {
      return parseInt(multi * Math.random(), 10);
    };
}

var philomania = {
    'philHead'      : undefined,
    'denchHeads'    : []
};


philomania.init = function() {
    philomania.generateDenchHeads();
    philomania.moveDenchHeads();
};

philomania.generateDenchHeads = function() {
    console.log('philomania.generateDenchHeads()');
    for (var i in philomania.denchHeads) {
        let head = philomania.denchHeads[i];
        head.deinit();
    }

    var denchHead = new MovingSprite(0, 'red', 'dench_head_1');
    philomania.denchHeads.push(denchHead);
};

philomania.moveDenchHeads = function() {
    console.log('philomania.moveDenchHeads()');
    for (var i in philomania.denchHeads) {
        let head = philomania.denchHeads[i];
        head.move();
    }

    setTimeout(function() {
        philomania.moveDenchHeads();
    }, 1000);
};