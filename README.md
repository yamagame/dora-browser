# dora-browser 

遠隔操作できるブラウザです。

## 準備

```
$ npm i
```

## 実行

```
$ npm start
```

## 使い方

実行すると、内部でWebサーバーが起動します。POSTリクエストを使ってコマンドを送信するとコントロールできます。

以下の例では、localhostで操作することを想定して説明しています。

### createコマンド

Windowを開くメッセージ

```
$ curl -X POST http://localhost:5000/create/[ウインドウ名]
```

例：

```
$ curl -X POST http://localhost:5000/create/main
```

以下のようにすると開くページのURLを指定できます。

```
$ curl -X POST -d '{"url":"https://www.apple.com/"}' --header "content-type:application/json" http://localhost:5000/create/main
```

### reloadコマンド

ページをリロードします。

```
$ curl -X POST http://localhost:5000/reload/[ウインドウ名]
```

### closeコマンド

指定したウインドウを閉じます。

```
$ curl -X POST http://localhost:5000/close/[ウインドウ名]
```

例：

```
$ curl -X POST http://localhost:5000/close/main
```

### printコマンド

指定したウインドウを印刷します。

```
$ curl -X POST http://localhost:5000/print/[ウインドウ名]
```

### closeAllコマンド

全てのウインドウを閉じます

```
$ curl -X POST http://localhost:5000/closeAll
```

## セキュリティについて

Electronを使用した遠隔操作できるブラウザです。使用には注意してください。
