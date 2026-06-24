-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: hydrocert
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `alici`
--

DROP TABLE IF EXISTS `alici`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alici` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ad` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ulke` char(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sektor` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alici`
--

LOCK TABLES `alici` WRITE;
/*!40000 ALTER TABLE `alici` DISABLE KEYS */;
INSERT INTO `alici` VALUES (1,'Steelcorp Europe','DE','Celik'),(2,'GreenChem GmbH','DE','Kimya'),(3,'Anadolu Gubre A.S.','TR','Gubre');
/*!40000 ALTER TABLE `alici` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `denetim_log`
--

DROP TABLE IF EXISTS `denetim_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `denetim_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sertifika_id` int NOT NULL,
  `eski_durum` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `yeni_durum` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `degisim_ani` datetime DEFAULT CURRENT_TIMESTAMP,
  `aciklama` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `denetim_log`
--

LOCK TABLES `denetim_log` WRITE;
/*!40000 ALTER TABLE `denetim_log` DISABLE KEYS */;
INSERT INTO `denetim_log` VALUES (1,1,'aktif','tukenmis','2026-06-24 03:17:40','Durum degisti: TR-H2-2025-0001');
/*!40000 ALTER TABLE `denetim_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sertifika`
--

DROP TABLE IF EXISTS `sertifika`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sertifika` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parti_id` int NOT NULL,
  `seri_no` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `toplam_kg` decimal(12,2) NOT NULL,
  `ihrac_tarihi` date NOT NULL,
  `gecerlilik` date NOT NULL,
  `durum` enum('aktif','tukenmis','iptal') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aktif',
  `metadata` json DEFAULT NULL,
  `audit_skor` int GENERATED ALWAYS AS (cast(json_unquote(json_extract(`metadata`,_utf8mb4'$.audit_skor')) as unsigned)) VIRTUAL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `seri_no` (`seri_no`),
  KEY `fk_sertifika_parti` (`parti_id`),
  KEY `idx_audit_skor` (`audit_skor`),
  CONSTRAINT `fk_sertifika_parti` FOREIGN KEY (`parti_id`) REFERENCES `uretim_partisi` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_sertifika_kg` CHECK ((`toplam_kg` > 0)),
  CONSTRAINT `chk_sertifika_tarih` CHECK ((`gecerlilik` > `ihrac_tarihi`))
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sertifika`
--

LOCK TABLES `sertifika` WRITE;
/*!40000 ALTER TABLE `sertifika` DISABLE KEYS */;
INSERT INTO `sertifika` (`id`, `parti_id`, `seri_no`, `toplam_kg`, `ihrac_tarihi`, `gecerlilik`, `durum`, `metadata`) VALUES (1,1,'TR-H2-2025-0001',18500.00,'2025-02-05','2026-02-05','tukenmis',NULL),(2,4,'DE-H2-2025-0001',31000.00,'2025-02-10','2026-02-10','aktif','{\"denetci\": \"TÜV SÜD\", \"belgeler\": [\"iso14064\", \"ghg_protocol\"], \"standart\": \"CertifHy EU\", \"audit_skor\": 92}'),(3,3,'TR-H2-2025-0002',9400.00,'2025-02-12','2026-02-12','aktif','{\"denetci\": \"Bureau Veritas\", \"belgeler\": [\"iso14064\"], \"standart\": \"YEK-G\", \"audit_skor\": 78}'),(4,2,'TR-H2-2025-0003',17200.00,'2025-03-05','2026-03-05','aktif',NULL),(5,1,'API-TEST-001',5000.00,'2025-04-01','2026-04-01','aktif',NULL);
/*!40000 ALTER TABLE `sertifika` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_sertifika_durum_log` AFTER UPDATE ON `sertifika` FOR EACH ROW BEGIN
  IF OLD.durum <> NEW.durum THEN
    INSERT INTO denetim_log (sertifika_id, eski_durum, yeni_durum, aciklama)
    VALUES (NEW.id, OLD.durum, NEW.durum,
            CONCAT('Durum degisti: ', OLD.seri_no));
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `tesis`
--

DROP TABLE IF EXISTS `tesis`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tesis` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uretici_id` int NOT NULL,
  `ad` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `konum` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kapasite_mw` decimal(8,2) NOT NULL,
  `enerji_kaynagi` enum('gunes','ruzgar','hidro','karma') COLLATE utf8mb4_unicode_ci NOT NULL,
  `kurulum_tarihi` date DEFAULT NULL,
  `guncelleme` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_tesis_uretici` (`uretici_id`),
  CONSTRAINT `fk_tesis_uretici` FOREIGN KEY (`uretici_id`) REFERENCES `uretici` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tesis`
--

LOCK TABLES `tesis` WRITE;
/*!40000 ALTER TABLE `tesis` DISABLE KEYS */;
INSERT INTO `tesis` VALUES (1,1,'Karapinar GES-1','Konya',250.00,'gunes','2024-03-15','2026-06-23 23:11:25'),(2,1,'Cesme RES','Izmir',120.50,'ruzgar','2023-11-01','2026-06-23 23:11:25'),(3,2,'Nordsee Offshore','Hamburg',400.00,'ruzgar','2025-01-20','2026-06-23 23:11:25');
/*!40000 ALTER TABLE `tesis` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transfer`
--

DROP TABLE IF EXISTS `transfer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transfer` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sertifika_id` int NOT NULL,
  `alici_id` int NOT NULL,
  `tarih` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `miktar_kg` decimal(12,2) NOT NULL,
  `fiyat_eur` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_transfer_sertifika` (`sertifika_id`),
  KEY `fk_transfer_alici` (`alici_id`),
  CONSTRAINT `fk_transfer_alici` FOREIGN KEY (`alici_id`) REFERENCES `alici` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_transfer_sertifika` FOREIGN KEY (`sertifika_id`) REFERENCES `sertifika` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_transfer_kg` CHECK ((`miktar_kg` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transfer`
--

LOCK TABLES `transfer` WRITE;
/*!40000 ALTER TABLE `transfer` DISABLE KEYS */;
INSERT INTO `transfer` VALUES (1,1,1,'2026-06-24 02:56:34',10000.00,4.50),(2,1,2,'2026-06-24 02:56:34',8500.00,4.65),(3,2,1,'2026-06-24 02:56:34',31000.00,4.20),(4,3,3,'2026-06-24 02:56:34',9400.00,5.10);
/*!40000 ALTER TABLE `transfer` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_transfer_kapasite_kontrol` BEFORE INSERT ON `transfer` FOR EACH ROW BEGIN
  DECLARE v_kapasite   DECIMAL(12,2);
  DECLARE v_satilan    DECIMAL(12,2);

  SELECT toplam_kg INTO v_kapasite
  FROM sertifika WHERE id = NEW.sertifika_id;

  SELECT COALESCE(SUM(miktar_kg), 0) INTO v_satilan
  FROM transfer WHERE sertifika_id = NEW.sertifika_id;

  IF (v_satilan + NEW.miktar_kg) > v_kapasite THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Sertifika kapasitesi asildi: satilamaz';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `uretici`
--

DROP TABLE IF EXISTS `uretici`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `uretici` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ad` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ulke` char(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vergi_no` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `olusturulma` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vergi_no` (`vergi_no`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `uretici`
--

LOCK TABLES `uretici` WRITE;
/*!40000 ALTER TABLE `uretici` DISABLE KEYS */;
INSERT INTO `uretici` VALUES (1,'Anadolu Yesil Enerji A.S.','TR','TR1234567890','2026-06-23 23:11:24'),(2,'Nordsee H2 GmbH','DE','DE9988776655','2026-06-23 23:11:24');
/*!40000 ALTER TABLE `uretici` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `uretim_partisi`
--

DROP TABLE IF EXISTS `uretim_partisi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `uretim_partisi` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tesis_id` int NOT NULL,
  `baslangic` date NOT NULL,
  `bitis` date NOT NULL,
  `h2_kg` decimal(12,2) NOT NULL,
  `enerji_kwh` decimal(14,2) NOT NULL,
  `karbon_yogunlugu` decimal(6,3) NOT NULL,
  `durum` enum('uretildi','sertifikali','iptal') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'uretildi',
  `olusturulma` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_parti_tesis_tarih` (`tesis_id`,`baslangic`),
  CONSTRAINT `fk_parti_tesis` FOREIGN KEY (`tesis_id`) REFERENCES `tesis` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_enerji_pozitif` CHECK ((`enerji_kwh` > 0)),
  CONSTRAINT `chk_h2_pozitif` CHECK ((`h2_kg` > 0)),
  CONSTRAINT `chk_karbon_negatif` CHECK ((`karbon_yogunlugu` >= 0)),
  CONSTRAINT `chk_tarih_sirasi` CHECK ((`bitis` >= `baslangic`))
) ENGINE=InnoDB AUTO_INCREMENT=131076 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `uretim_partisi`
--

LOCK TABLES `uretim_partisi` WRITE;
/*!40000 ALTER TABLE `uretim_partisi` DISABLE KEYS */;
INSERT INTO `uretim_partisi` VALUES (1,1,'2025-01-01','2025-01-31',18500.00,920000.00,1.250,'sertifikali','2026-06-23 23:13:40'),(2,1,'2025-02-01','2025-02-28',17200.00,870000.00,1.310,'sertifikali','2026-06-23 23:13:40'),(3,2,'2025-01-01','2025-01-31',9400.00,510000.00,2.050,'uretildi','2026-06-23 23:13:40'),(4,3,'2025-01-01','2025-01-31',31000.00,1480000.00,0.980,'uretildi','2026-06-23 23:13:40');
/*!40000 ALTER TABLE `uretim_partisi` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `v_aktif_sertifikalar`
--

DROP TABLE IF EXISTS `v_aktif_sertifikalar`;
/*!50001 DROP VIEW IF EXISTS `v_aktif_sertifikalar`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_aktif_sertifikalar` AS SELECT 
 1 AS `seri_no`,
 1 AS `toplam_kg`,
 1 AS `gecerlilik`,
 1 AS `uretici`,
 1 AS `tesis`,
 1 AS `satilan_kg`,
 1 AS `kalan_kg`*/;
SET character_set_client = @saved_cs_client;

--
-- Dumping routines for database 'hydrocert'
--
/*!50003 DROP PROCEDURE IF EXISTS `sp_uretici_cci` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_uretici_cci`(IN p_esik DECIMAL(6,3))
BEGIN
  SELECT u.ad,
         ROUND(SUM(p.karbon_yogunlugu * p.h2_kg) / SUM(p.h2_kg), 3) AS agirlikli_karbon,
         ROUND(100 * (1 - (SUM(p.karbon_yogunlugu * p.h2_kg) / SUM(p.h2_kg)) / p_esik), 1) AS cci_skor
  FROM uretim_partisi p
  JOIN tesis t   ON t.id = p.tesis_id
  JOIN uretici u ON u.id = t.uretici_id
  GROUP BY u.id, u.ad
  ORDER BY cci_skor DESC;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Final view structure for view `v_aktif_sertifikalar`
--

/*!50001 DROP VIEW IF EXISTS `v_aktif_sertifikalar`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_aktif_sertifikalar` AS select `s`.`seri_no` AS `seri_no`,`s`.`toplam_kg` AS `toplam_kg`,`s`.`gecerlilik` AS `gecerlilik`,`u`.`ad` AS `uretici`,`t`.`ad` AS `tesis`,coalesce(sum(`tr`.`miktar_kg`),0) AS `satilan_kg`,(`s`.`toplam_kg` - coalesce(sum(`tr`.`miktar_kg`),0)) AS `kalan_kg` from ((((`sertifika` `s` join `uretim_partisi` `p` on((`p`.`id` = `s`.`parti_id`))) join `tesis` `t` on((`t`.`id` = `p`.`tesis_id`))) join `uretici` `u` on((`u`.`id` = `t`.`uretici_id`))) left join `transfer` `tr` on((`tr`.`sertifika_id` = `s`.`id`))) where (`s`.`durum` = 'aktif') group by `s`.`id`,`s`.`seri_no`,`s`.`toplam_kg`,`s`.`gecerlilik`,`u`.`ad`,`t`.`ad` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-24  4:04:38
