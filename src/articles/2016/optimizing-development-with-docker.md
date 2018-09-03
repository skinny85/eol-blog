---
id: 19
layout: article.html
title: Optimizing development with Docker
summary: "I was recently developing an application targeting a
	Platform-as-a-Service cloud provider that used Docker containers
	as the deployment unit. I wanted to share my experiences in how
	Docker can be used for improving the development process - including
	some open questions that I've yet to find answers to."
created_at: 2016-05-16
---

It has been around 16 months since I wrote an [article explaining what Docker is](/my-primer-on-Docker) on this blog. During that time, the hype around Docker has not faded - on the contrary, it has established itself as a very important technology, and the future of distributed computing - especially in the cloud (if you want to believe the evangelists, that is).

I wanted to get more experience using Docker in a production-like setting, and the perfect opportunity arose when it turned out that the Android application I was working on would need a backend component. I found a PaaS provider that deployed Docker containers to the cloud (and had a free plan, of course :) ), and got to work.

My article from a while ago focused mainly on how Docker worked; in this one, I want to discuss how you can leverage it in the development process of your application. As it turns out, Docker solves some issues that were traditionally regarded as sources of pain when doing development - for example, external dependencies. I also found that there are still some open questions about the proper way of using it that the community is yet to figure out. That is to be expected when dealing with a tool as young as Docker, and it's also quite exciting - it means that there's still something to discover!

### A little background

The application I was talking about is a simple REST API, backed by a database, returning JSON to the client. I decided to go with JVM technologies for this project: [Spring Boot](http://projects.spring.io/spring-boot/) as the framework of choice, with [Kotlin](https://kotlinlang.org/), a relatively new language from [JetBrains](https://www.jetbrains.com/) (the company behind Intellij and other IDEs and developer tools). The complete source code is on [GitHub](https://github.com/skinny85/drive-to-work/tree/master/web-app).

### Concern #1: choosing your base image

I started with the [Spring Boot guide on Docker](https://spring.io/guides/gs/spring-boot-docker/), and pretty soon I ran into problems. Not with the guide itself, mind you; it's really pretty good. The issue came up when I ran `docker images`, and saw the size of the base Java image that was used for the example. Do you want to venture a guess how big it is?

642 megabytes.

Now, I understand nowadays disk space is cheap, and networks are getting faster; but 642 MBs just for the JVM is absurd. And don't forget that you will have to add the size of your actual application to that, which, when using Spring, can be quite substantial.

The worst part is that the tutorial uses the official Java 8 image. Which means anybody that just follows it without explicitly checking the size (and a lot of people probably won't bother, because it's, you know, official and everything) will be dragging along a lot of garbage with their containers.

Fortunately, after a little digging, I found an awesome alternative - the [anapsix/alpine-java image](https://github.com/anapsix/docker-alpine-java), weighing in at a cool 122 MBs.

If you want to learn more about avoiding bloating your Docker images (and other interesting advice), I would recommend [this great article](https://www.datawire.io/not-engineer-running-3-5gb-docker-images/) by David McKay.

So, my first tip is: be aware of what base images you are using. Sometimes, the obvious answer to the question "Which base image should we use?" is not the correct one.

### Concern #2: the development workflow

Dockerizing your Java application is not that difficult (especially if it's a Spring Boot app). There are a lot of guides and tutorials on the web explaining how to do that. Many build tools have plugins that make that task fairly easy. They all function in pretty much the same way: you invoke a special target (just as an example, if you're using Gradle, it would be something like `gradle distDocker`), and your code is compiled, packaged, and a Docker image is created from it. The `Dockerfile` used to build the image, in case of a Java Spring Boot app, looks something like this:

```
FROM anapsix/alpine-java

ADD dtw-web.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "/app.jar"]
```

Pretty elementary - we add the JAR that is the result of packaging our project to the container, expose the port set in the application's configuration (8080 in this case), and then run the JAR when the container is started.

Now, if you want to run your application locally, you would issue a command similar to the following:

```
docker run -i -t --name=container-name -p 8080:8080 your-image-name:tag
```

While this works, it has a pretty serious downside: the development workflow. To illustrate what I mean, I want you to imagine the above container hosts a web application. You have it working locally, and you make a code change. In order to observe that change, you have to:

1. Stop the running container
2. Invoke your build tool with the command to re-build the image
3. Issue the `docker run` command again with the proper arguments
4. Refresh the browser window

I hope I don't have to explain that all of this takes time. Now imagine that wait for every single tiny code change. In an era when we have frameworks that [don't even require you to refresh the browser to see your changes](https://www.youtube.com/watch?v=j-kj2qwJa_E), this is unacceptable. In my case it was especially painful, as Spring Boot comes with [built-in hot reloading functionality](https://spring.io/blog/2015/06/17/devtools-in-spring-boot-1-3).

How can we improve the situation? The solution seems obvious - we need to move our source code and the build process into the container, instead of just having the resulting binary there. This setup is much less popular than the previous one, and I have a feeling that there aren't that many established practices in the Docker community on how to achieve it in a simple and efficient way. It also depends to a degree on the technology used inside the continer (Java and PHP would be packaged slightly differently, for example).

After some tinkering, my first attempt looked like this:

```
FROM anapsix/alpine-java

RUN mkdir /app
ADD . /app
VOLUME /app

EXPOSE 8080
WORKDIR /app
ENV GRADLE_OPTS -Dorg.gradle.native=false
CMD ["./gradlew", "bootRun"]
```

Couple of notes about this `Dockerfile`:

*   Both `ADD` and `VOLUME` are used on the same directory, as the container running in production won't have a volume with the project contents mounted, and so they have to be added separately.
*   The `ENV GRADLE_OPTS -Dorg.gradle.native=false` was added because without it, Gradle fails while trying to use some native library (used for I/O I believe). It might be the case that the image, in an effort to conserve space, removed something that Gradle expects to be present.

This works - if you mount the project directory in the `/app` volume of the container, your application should be reloaded when you change (and, in Spring Boot's DevTools case, recompile) the code. But it has a serious flaw. Because the dependencies are cached inside the container, every time you `run` a new one, they will all have to be downloaded from Maven Central and the other repositories hosting the library JARs into the container.

You can use a trick for avoiding this download when running locally. You have to share your host's dependency resolution cache with the container. In the case of Gradle, it looks something like this:

```
RUN mkdir -p /root/.gradle
ENV HOME /root
VOLUME /root/.gradle
```

Now, if you invoke the image built from the `Dockerfile` with the above 3 lines added in this way:

```
docker run -it -p 8080:8080 -v .:/app -v ~/.gradle:/root/.gradle image-name:tag
```

, the container and the host will share the Gradle cache, and so the dependencies will not have to be downloaded again.

While this works, it has some serious downsides:

* It only works for local development - you can't use this trick in production. Meaning every time you start an instance of that container in production, it will first have to download all of the dependencies from Maven Central before it starts. Not really ideal (and it actually might be impossible, if your production environment limits access to the public internet).
* It breaks the Docker philosophy - a container is meant to, you know, contain everything needed to run the service it represents. Downloading a bunch of JARs from repo1.maven.org on startup is not really how the "established wisdom" dictates you should do things.

A potential solution might be adding `RUN ["./gradlew", "assemble"]` to the `Dockerfile`. This means that the dependencies will be downloaded into the container (and the application packaged) during the image build phase. However, because you can't use volumes when the container is building, the dependencies will be re-downloaded every time you rebuild the image locally. So, while this solves the above two issues, it does so at the cost of local development convenience.

Is there a way to have your cake, and eat it too - have fast local development, and a slim, quickly built production image at the same time? To be honest, I'm not sure. I think Docker's youth is showing here - there hasn't been that much time for the community to establish best practices in this area, especially that the details of the setup depend on the technology you use in the container. I've done some research, and there's some information around - but not nearly as much as just putting the build result binary in the container and calling it a day.

The best resource that I've found about the issue is [this article](https://blog.ionelmc.ro/2016/05/07/dealing-with-docker/#the-ecosystem) by Ionel Cristian Mărieș. A fair warning: the post is fairly long, and quite dense, information-wise; I still haven't absorbed all of it (the beginning is also less interesting, so I purposefully linked to a paragraph that should be a good starting point). But it does contain a large amount of non-trivial information, and so I think it's definitely worth a read.

For now, I've settled on a pretty hacky solution - I use two different containers. For development, I use the `Dockerfile` with the source code and Gradle cache mounted as volumes, and for production - the one just starting the JAR resulting from packaging the project. And while I agree that it negates one of the core advantages of Docker - developing with exactly the same binary artifact locally as the one you run in production - it hasn't been a problem so far. In the case of Spring Boot in particular, I feel it's similar to developing with `gradle bootRun`, but running in production with `java -jar` - you don't really expect any differences between the two.

I would love to hear your experiences about this. How do you handle the tension between local development and production for your containers? Does not running the same container locally that you do in production seem awful to you? Let me know in the comments.

And so, my second tip is: be conscious of what does the development experience look like for the container configuration that you use. This is a harder problem than might appear at first glance.

### Concern #3: external dependencies

The application mentioned above uses MySQL as the data store (and before you bring out the pitchforks, just know that it was chosen because that was the only open-source storage solution that that particular PaaS provider supported as an additional service for the apps running on its platform). Now, in the good old days, if you wanted to fork my code and work on it on your own workstation, you would have to:

* find in the code somewhere that I used MySQL
* install MySQL locally (preferably after looking up the version used in production, and then going through the hassle of installing the same one, instead of just the newest)
* make sure that the local instance was configured to listen on the same port that the local configuration used (another thing to find in the code)
* create the appropriate schema and user with the same password used by the application, and make sure the user has the permissions to access that database

After finishing all of that, then, and only then, can you start the application correctly and begin doing development. Provided, you know, that the application uses some automated way of creating the database schema. And what if another application that you've been working on also needs MySQL, but on a different port - or, God forbid, in a different version?

This is an irritating, manual process that involves a lot of "I changed this, let's run the app and see what error it throws at startup this time" steps. And a lot of applications have significantly more external dependencies than just a database. I have worked on projects that required days to get a local development environment set up. And you would have to repeat that work for every project you wanted to work on. I hope you'll agree that it's not really the best on-boarding experience.

Fortunately, Docker is well suited to solving this particular problem. You just need to run a container with MySQL!

```
docker run -it --name=db \
	 -e MYSQL_ROOT_PASSWORD=pw -e MYSQL_DATABASE=my_schema \
	 mysql:5.6
```

That's pretty much everything you need to do to have MySQL 5.6 running on your local machine, with the username `root` / password `pw`, and the schema `my_schema` created.

Now, to get your container with the application to know the IP address and the port needed to connect to the database through the magic of Docker networking, you must run it with the `--link` option, giving the name of the database container as the argument:

```
docker run -it --name=app --link=db app-image
```

What this will do is set a bunch of environment variables inside the `app` container that will specify the network coordinates of the `db` container. How you use them to set the actual connection properties in the application is your responsibility, and usually depends on the particular technology you are using. In Spring Boot's case, it's fairly easy, as you can just use them inside the application configuration files with the `${}` syntax (just don't forget to convert `THIS_NAME` to `this.name`). Check out the [official Docker documentation](https://docs.docker.com/engine/userguide/networking/default_network/dockerlinks/#environment-variables) to find out exactly what environment variables are set when linking.

Now, this works, but the process is still far from ideal. You have to know to create the MySQL container before you start the application container, and you need to repeat that every time you stop the containers. And what if you have a more complex set of dependencies, that also depend on each other? The setting up phase can grow to become quite complex. Not to mention that the commands themselves are starting to get quite long.

Enter [docker-compose](https://docs.docker.com/compose/) - a tool which allows you store all of that information in a YAML file, which you can version with the rest of the project, and which orchestrates your Docker setup.

In my opinion, `docker-compose` is useful even if you have only one container in your setup. For instance, remember the command shown above needed to run the container with the source code and Gradle cache mounted as volumes?

```
docker run -it -p 8080:8080 -v .:/app -v ~/.gradle:/root/.gradle image-name:tag
```

This is quite involved. You would probably add this command to the documentation, stored in a README file of the project, or perhaps in some external Wiki. Best case, you would add it to a shell script included with the source code. With `docker-compose`, however, you can do this:

```
app:
	image: image-name:tag
	ports:
		- 8080:8080
	volumes:
		- ~/.gradle:/root/.gradle
		- .:/app
	command: ./gradlew bootRun
```

, and everyone using your project can simply invoke `docker-compose up`, and get the equivalent experience to writing that above command by hand.

Where `docker-compose` shines, however, is when you have multiple containers that form your applicaton's environment. For example, here's how we might set up the MySQL dependency we executed by hand earlier:

```
app:
	build: .
	links:
		- db
db:
	image: mysql:5.6
	environment:
		- MYSQL_ROOT_PASSWORD=pw
		- MYSQL_DATABASE=my_schema
```

Because we specified `db` in the `links` section of the `app` container, `docker-compose` will know to start the `db` container before the `app` one. You can extend this basic setup to include all of the dependencies that your application needs to function in production: external caches, message queues, front-end web servers etc.

And so, my third and final tip is: always use `docker-compose` (even if at the moment you only have one container in your project). Your entire application stack should be provisioned and started with a single command: `docker-compose up`.

### Wrapping up

That's all I have for today. I'm eager to hear your voice in the comments. Do you have your own tips for developing with Docker? What does your workflow usually look like? It would be great if you could share your experiences.
