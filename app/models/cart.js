module.exports = function Cart(oldCart){
	this.items = oldCart.items || {};
	this.totalPrice = oldCart.totalPrice || 0;
	this.totalQty = oldCart.totalQty || 0;
	this.add = function(item, id) {
		var storedItem = this.items[id];
		if (!storedItem) {
			storedItem = this.items[id] = {item: item, price: item.price};
		}
		this.totalPrice += storedItem.item.price;
		this.totalQty += 1;
	};
	this.removeItem = function(item, id) {
		this.totalQty--;
		this.totalPrice -= item.price;
		delete this.items[id];
	};
	this.generateArray = function() {
		var arr = [];
		for (var id in this.items) {
			arr.push(this.items[id]);
		}
		return arr;
	};
};
