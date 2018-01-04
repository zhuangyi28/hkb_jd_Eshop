/**
 * Created by ZHUANGYI on 2017/6/12.
 */

/*切换tab*/

var jdShoppingCart = {

    editDeleteChange: function () {

        document.getElementById('editTabBtn').addEventListener('click', function () {


            if (this.innerText == '编辑') {                                                                                   //当文字为编辑时候

                this.innerText = '完成';                                                                                    //点击为'完成'

                document.getElementById('settlementTab').style.transform = 'translateY(55px)';

                document.getElementById('deleteTab').style.transform = 'translateY(0)';

            }

            else if (this.innerText == '完成') {

                this.innerText = '编辑';

                document.getElementById('settlementTab').style.transform = 'translateY(0)';

                document.getElementById('deleteTab').style.transform = 'translateY(55px)';
            }

        })

    },
    checkBoxChange:function () {

        var radiobox = document.getElementById('list_contain').getElementsByClassName('radio');

        var allbox = document.getElementsByClassName('allcheck');

        for (var i=0;i<allbox.length;i++){

            allbox[i].addEventListener('click',function () {

                var thisChecked = this.checked; //点中的那个为亮

                radioCheckWay(thisChecked);

                tabRadioCheckWay(thisChecked);


            },false);

        }

        for( var j=0;j<radiobox.length;j++){

            radiobox[j].addEventListener('click',function () {

                tabRadioCheckWay(judgeRadioChecked());

            },false);

        }



        //判断方式 判断全亮&不全亮 返回值为true 全亮 ;返回值为false 不全亮

        function judgeRadioChecked() {

            var checkBoxTab = document.getElementById('list_contain').getElementsByClassName('radio');

            for (var i = 0; i < checkBoxTab.length; i++) {

                if (!checkBoxTab[i].checked) {

                    return false;
                }
            }
            return true;
        }

        //当传参数为true时候全亮，false为全不亮 （所有tab按钮）


        function radioCheckWay(isChecked) {

            isCheck(document.getElementById('list_contain').getElementsByClassName('radio'),isChecked)
        }

        //当传参数为true时候全亮，false为全不亮 (两个tab的全选按钮)

        function tabRadioCheckWay(isChecked) {


            isCheck(document.getElementsByClassName('allcheck'),isChecked)

        }

        function isCheck(ele,isCheck) {

            for (var i=0; i<ele.length;i++){

                ele[i].checked = isCheck;

            }

        }


    },
    //复选框单选
    checkBoxChoose:function(obj) {

        var allCheckBox = document.getElementsByClassName('select_key');

        for (var i = 0; i < allCheckBox.length; i++) {


            if (allCheckBox[i] == obj && obj.checked) {

                allCheckBox[i].checked = true;

            } else {

                allCheckBox[i].checked = false;
            }
        }

    }


};












