/**
 * Created by ZHUANGYI on 2017/6/22.
 */
var jfOrderTab = {

    switchTab: function () {

        var navTab = document.getElementById('orderTab').getElementsByClassName('tab');

        var orderList = document.getElementsByClassName('shop_order_list');

        for (var i = 0; i < navTab.length; i++) {

            navTab[i].index = i;

            navTab[i].addEventListener('click', function () {

                for (var j = 0; j < navTab.length; j++) {

                    orderList[j].className = orderList[j].className.replace(' show', '');

                }
                orderList[this.index].className += ' show'
            })
        }
    },

    hrefTab:function () {


        document.getElementsByClassName('tab_return')[0].addEventListener('click',function () {

            var thisEle = document.getElementsByClassName('tab_contain')[0].getElementsByClassName('tab');


            for (var i=0;i<thisEle.length;i++){

                thisEle[i].className =  thisEle[i].className.replace('choose_tab', '');

            }

            this.className += ' choose_tab'



        },false)

}
};


