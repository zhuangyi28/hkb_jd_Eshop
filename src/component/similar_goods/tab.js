var similarList = {

    //tab切换
    /*changeAccountList: function (thisEle, e) {

    var evt = e || window.event;

    var thisTargetEle = evt.srcElement || evt.target;

    var thisBox = thisEle;

    var thisTabEle = thisBox.getElementsByClassName('tab');

    var tabContent = document.getElementsByClassName('similar_account_content')[0];

    for (var i = 0; i < thisTabEle.length; i++) {

        if (thisTargetEle == thisTabEle[i]) {

            if (thisBox.getElementsByClassName('choose_tab')[0]) {

                thisBox.getElementsByClassName('choose_tab')[0].className = 'tab'

            }

            thisTabEle[i].className += ' choose_tab';

            if (tabContent.getElementsByClassName('show')[0]) {

                tabContent.getElementsByClassName('show')[0].className = 'similar_details_content'
            }


            tabContent.getElementsByClassName('similar_details_content')[i].className += ' show'
        }

    }


},*/

    //重置
    listResetAll:function () {

    var boxEle = document.getElementsByClassName('watch_brand_list')[0];

    var allEle = boxEle.getElementsByTagName('div');

    for (var i = 0; i < allEle.length; i++) { //找到页面上所有的selected 并且删除

        allEle[i].className = allEle[i].className.replace('selected', '')

    }

},

    //照相似页面tab
    chooseTabSimilar:function (e) {

    var evt = e || window.event;

    var thisTargetEle = evt.srcElement || evt.target;

    if(thisTargetEle!=this) {

        this.getElementsByClassName("choose_tab")[0].className = 'tab';

        thisTargetEle.className = 'tab choose_tab';

    }




    },

    //选择分类
    chooseSort:function (e) {

        var evt = e || window.event;

        var thisTargetEle = evt.srcElement || evt.target;




        if (thisTargetEle.className == 'watch_brand_list') { //如果点到的是自己 则class不变

            thisTargetEle.className = 'watch_brand_list';
        }
        else {


            if (document.getElementsByClassName('selected')[0]) {

                document.getElementsByClassName('selected')[0].className = ''



            }


            thisTargetEle.className += ' selected';







           /* if (thisTargetEle.className.indexOf('selected') > -1) {  //点击本身也会取消

                thisTargetEle.className = '';
            }
            else {

                thisTargetEle.className += ' selected';        //也可以点击其他的
            }*/
        }

    },

    //下拉分类
    brandDialog:function () {

    document.getElementsByClassName('brand')[0].addEventListener('click',function () {


        followList.retractTab();

        if (document.getElementById('watch_brand_list').className.indexOf('show') > -1) {

            //收回下拉框
            watchBrand.hide();

            this.className = 'brand';


        }

        else {


            if(this.className.indexOf('show') == -1){


                this.className += ' show';
            }

            watchBrand.show();




        }



    },false)

},

    //默认&查看有货选择
    chooseListTab:function () {

    var thisTab = document.getElementsByClassName('tab');



    for(var i=0;i<thisTab.length;i++){

        thisTab[i].addEventListener('click',function () {


            if(document.getElementsByClassName('choose_tab')[0]){

                document.getElementsByClassName('choose_tab')[0].className = 'tab';


            }

            followList.retractTab();


            this.className = 'tab choose_tab';

            watchBrand.hide();

        },false)
    }
},



}


